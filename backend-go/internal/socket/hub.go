package socket

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"onlinejudge/internal/config"
	"onlinejudge/internal/db"
	"onlinejudge/internal/models"
	"onlinejudge/internal/rdb"
)

// Hub manages WebSocket connections grouped by submission ID.
// Replaces Socket.IO from the Node.js implementation.
//
// Frontend migration: replace socket.io-client with native WebSocket:
//   ws = new WebSocket("ws://host/api/ws")
//   ws.onopen = () => ws.send(JSON.stringify({type:"join",submissionId:123}))
//   ws.onmessage = (e) => { const {type,data} = JSON.parse(e.data); if(type==="update") handleUpdate(data) }

type Hub struct {
	mu      sync.RWMutex
	rooms   map[int][]*wsClient
}

type wsClient struct {
	conn  *websocket.Conn
	subID int
	send  chan []byte
}

func NewHub() *Hub {
	return &Hub{rooms: make(map[int][]*wsClient)}
}

func (h *Hub) register(c *wsClient) {
	h.mu.Lock()
	h.rooms[c.subID] = append(h.rooms[c.subID], c)
	h.mu.Unlock()
}

func (h *Hub) unregister(c *wsClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	clients := h.rooms[c.subID]
	for i, cl := range clients {
		if cl == c {
			h.rooms[c.subID] = append(clients[:i], clients[i+1:]...)
			break
		}
	}
	if len(h.rooms[c.subID]) == 0 {
		delete(h.rooms, c.subID)
	}
}

func (h *Hub) broadcast(submissionID int, data []byte) {
	h.mu.RLock()
	clients := make([]*wsClient, len(h.rooms[submissionID]))
	copy(clients, h.rooms[submissionID])
	h.mu.RUnlock()

	for _, c := range clients {
		select {
		case c.send <- data:
		default:
		}
	}
}

// StartRedisSubscriber subscribes to Redis and forwards updates to WebSocket clients.
func (h *Hub) StartRedisSubscriber(ctx context.Context) {
	pubsub := rdb.Client.Subscribe(ctx, "submission:updated")
	defer pubsub.Close()

	log.Println("[ws] redis subscriber started")
	ch := pubsub.Channel()

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var payload struct{ SubmissionID int `json:"submissionId"` }
			if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
				continue
			}
			var sub models.Submission
			if err := db.DB.Preload("Result").Where("id = ?", payload.SubmissionID).First(&sub).Error; err != nil {
				continue
			}
			data, _ := json.Marshal(map[string]interface{}{"type": "update", "data": sub})
			h.broadcast(payload.SubmissionID, data)
		}
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == "" || origin == config.C.FrontendOrigin
	},
}

// HandleWS upgrades an HTTP connection to WebSocket. Wrap in a Gin handler via hub.HandleWS(c.Writer, c.Request).
func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	client := &wsClient{conn: conn, send: make(chan []byte, 32)}
	defer func() {
		if client.subID > 0 {
			h.unregister(client)
		}
		conn.Close()
	}()

	// Read the join message to know which submission to subscribe to.
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		return
	}
	conn.SetReadDeadline(time.Time{})

	var join struct {
		Type         string `json:"type"`
		SubmissionID int    `json:"submissionId"`
	}
	if err := json.Unmarshal(msg, &join); err != nil || join.Type != "join" || join.SubmissionID == 0 {
		return
	}
	client.subID = join.SubmissionID
	h.register(client)

	// Writer goroutine
	done := make(chan struct{})
	go func() {
		defer close(done)
		for data := range client.send {
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				return
			}
		}
	}()

	// Keep connection alive; read pings/closes.
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}

	close(client.send)
	<-done
}
