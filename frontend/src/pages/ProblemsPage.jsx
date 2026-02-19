import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthProvider";
import { getProblemById, listProblems } from "../lib/problemsApi";
import {
  createCodeforcesSubmission,
  getSubmissionById,
  getSubmissionResult,
  listSubmissions,
} from "../lib/submissionsApi";
import { socket } from "../lib/socketClient";

const FINAL_STATUSES = ["ACCEPTED", "WRONG_ANSWER", "RUNTIME_ERROR"];

function statusPill(status) {
  if (status === "ACCEPTED") return "bg-emerald-500/15 text-emerald-300";
  if (status === "WRONG_ANSWER") return "bg-rose-500/15 text-rose-300";
  if (status === "RUNTIME_ERROR") return "bg-amber-500/15 text-amber-300";
  if (status === "RUNNING") return "bg-sky-500/15 text-sky-300";
  return "bg-zinc-700 text-zinc-200";
}

export default function ProblemsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [problems, setProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [problemsError, setProblemsError] = useState("");
  const [selectedProblemId, setSelectedProblemId] = useState(null);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [problemLoading, setProblemLoading] = useState(false);

  const [language, setLanguage] = useState("cpp");
  const [judgeProvider, setJudgeProvider] = useState("codeforces");
  const [sourceCode, setSourceCode] = useState("// OUTPUT: 3\nint main(){return 0;}");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [activeSubmission, setActiveSubmission] = useState(null);
  const [activeResult, setActiveResult] = useState(null);
  const [resultError, setResultError] = useState("");
  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const [leftTab, setLeftTab] = useState("description");
  const [rightBottomTab, setRightBottomTab] = useState("testcase");
  const tabButtonClass = (active) =>
    `appearance-none rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold transition ${
      active
        ? "border-amber-400 bg-zinc-800/80 text-zinc-100"
        : "border-transparent bg-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
    }`;

  useEffect(() => {
    let mounted = true;
    async function loadProblems() {
      setProblemsLoading(true);
      setProblemsError("");
      try {
        const list = await listProblems();
        if (!mounted) return;
        setProblems(list);
        if (list.length > 0) setSelectedProblemId(list[0].id);
      } catch (error) {
        if (mounted) setProblemsError(error.response?.data?.error || "Failed to load problems");
      } finally {
        if (mounted) setProblemsLoading(false);
      }
    }
    loadProblems();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedProblemId) {
      setSelectedProblem(null);
      return;
    }
    let mounted = true;
    async function loadProblem() {
      setProblemLoading(true);
      try {
        const problem = await getProblemById(selectedProblemId);
        if (mounted) setSelectedProblem(problem);
      } catch {
        if (mounted) setSelectedProblem(null);
      } finally {
        if (mounted) setProblemLoading(false);
      }
    }
    loadProblem();
    return () => {
      mounted = false;
    };
  }, [selectedProblemId]);

  useEffect(() => {
    let mounted = true;
    async function loadSubmissions() {
      setSubmissionsLoading(true);
      try {
        const items = await listSubmissions();
        if (mounted) setSubmissions(items);
      } catch {
        if (mounted) setSubmissions([]);
      } finally {
        if (mounted) setSubmissionsLoading(false);
      }
    }
    loadSubmissions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeSubmission?.id) return;
    const roomId = activeSubmission.id;
    socket.emit("watch-submission", roomId);

    async function hydrateResultIfNeeded(payload) {
      if (payload.result) {
        setActiveResult(payload.result);
        setResultError("");
        if (!FINAL_STATUSES.includes(payload.status)) return;
      }
      if (!FINAL_STATUSES.includes(payload.status)) return;
      try {
        const result = await getSubmissionResult(roomId);
        setActiveResult(result);
        setResultError("");
      } catch (error) {
        setResultError(error.response?.data?.error || "Result not ready");
      }
    }

    const handleUpdate = (payload) => {
      if (payload.id !== roomId) return;
      setActiveSubmission(payload);
      setSubmissions((prev) =>
        [payload, ...prev.filter((item) => item.id !== payload.id)].slice(0, 50)
      );
      hydrateResultIfNeeded(payload);
    };

    socket.on("submission:update", handleUpdate);
    return () => socket.off("submission:update", handleUpdate);
  }, [activeSubmission?.id]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        selectedProblem &&
          sourceCode.trim().length > 0 &&
          !submitting
      ),
    [selectedProblem, sourceCode, submitting]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selectedProblem) return;

    if (selectedProblem.source !== "codeforces") {
      setSubmitError("Remote submit is enabled only for Codeforces problems.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setResultError("");
    setActiveResult(null);
    setRightBottomTab("result");

    try {
      const submission = await createCodeforcesSubmission({
        language,
        sourceCode,
        remoteProblemKey: selectedProblem.id,
      });
      setActiveSubmission(submission);
      const latest = await getSubmissionById(submission.id);
      setActiveSubmission(latest);
      setSubmissions((prev) => [latest, ...prev.filter((item) => item.id !== latest.id)]);
    } catch (error) {
      setSubmitError(error.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#141824,_#0b0c10_45%,_#08090d)] text-zinc-100">
      <header className="flex h-12 items-center justify-between border-b border-zinc-800 bg-black/70 px-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="rounded bg-zinc-800 px-2 py-1 text-xs font-semibold text-amber-300">
            OJ
          </span>
          <span className="text-sm font-semibold text-zinc-200">
            {selectedProblem?.title || "Problem Workspace"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="appearance-none rounded-md border border-emerald-300/30 bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-[#03170f] shadow-[inset_0_-2px_0_rgba(0,0,0,0.22)] transition hover:bg-emerald-400 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
          <button
            onClick={handleLogout}
            className="appearance-none rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-100 transition hover:bg-zinc-800 active:translate-y-px"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="grid h-[calc(100vh-3rem)] grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#1a1a1e]">
          <div className="flex items-center gap-1 border-b border-zinc-800 bg-[#242429] px-2">
            {[
              ["description", "Description"],
              ["editorial", "Editorial"],
              ["solutions", "Solutions"],
              ["submissions", "Submissions"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tabButtonClass(leftTab === key)}
                onClick={() => setLeftTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-5">
            {leftTab === "description" ? (
              <>
                {problemLoading ? <p className="text-sm text-zinc-400">Loading problem...</p> : null}
                {!problemLoading && selectedProblem ? (
                  <article className="space-y-3">
                    <h2 className="text-3xl font-bold text-zinc-100">{selectedProblem.title}</h2>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300">
                        {selectedProblem.rating ? `Rating ${selectedProblem.rating}` : "Codeforces"}
                      </span>
                      <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs text-zinc-300">
                        {selectedProblem.slug}
                      </span>
                    </div>
                    {Array.isArray(selectedProblem.tags) && selectedProblem.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedProblem.tags.slice(0, 8).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <pre className="whitespace-pre-wrap rounded-lg bg-[#121216] p-4 text-sm leading-7 text-zinc-200">
                      {selectedProblem.statement}
                    </pre>
                  </article>
                ) : null}
              </>
            ) : null}

            {leftTab === "submissions" ? (
              <div className="space-y-2">
                {submissionsLoading ? (
                  <p className="text-sm text-zinc-400">Loading submissions...</p>
                ) : null}
                {!submissionsLoading && submissions.length === 0 ? (
                  <p className="text-sm text-zinc-400">No submissions yet.</p>
                ) : null}
                {submissions.map((item) => (
                  <button
                    key={item.id}
                    className="appearance-none w-full rounded-lg border border-zinc-700 bg-[#121216] px-3 py-2 text-left transition hover:border-zinc-500 hover:bg-[#191a22] active:translate-y-px"
                    onClick={async () => {
                      setActiveSubmission(item);
                      setRightBottomTab("result");
                      try {
                        const result = await getSubmissionResult(item.id);
                        setActiveResult(result);
                        setResultError("");
                      } catch (error) {
                        setActiveResult(null);
                        setResultError(error.response?.data?.error || "Result not ready");
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-100">#{item.id}</span>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusPill(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">
                      Problem {item.problemId} - {item.language}
                    </p>
                  </button>
                ))}
              </div>
            ) : null}

            {leftTab === "editorial" || leftTab === "solutions" ? (
              <div className="rounded-lg border border-zinc-700 bg-[#121216] p-4 text-sm text-zinc-400">
                {leftTab === "editorial" ? "Editorial panel placeholder." : "Solutions panel placeholder."}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-[#1a1a1e]">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#242429] px-4 py-2">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-zinc-100">{`</>`}</span>
              <span className="text-xl font-bold text-zinc-100">Code</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={judgeProvider}
                onChange={(e) => setJudgeProvider(e.target.value)}
                className="appearance-none rounded border border-zinc-700 bg-[#111217] px-2 py-1 text-sm text-zinc-200 outline-none transition focus:border-zinc-500"
              >
                <option value="codeforces">Codeforces Remote</option>
              </select>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="appearance-none rounded border border-zinc-700 bg-[#111217] px-2 py-1 text-sm text-zinc-200 outline-none transition focus:border-zinc-500"
              >
                <option value="cpp">C++</option>
                <option value="c">C</option>
                <option value="java">Java</option>
                <option value="python">Python</option>
                <option value="javascript">JavaScript</option>
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 border-b border-zinc-800 bg-[#111217] p-3">
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              className="mono h-full min-h-[240px] w-full resize-none rounded-lg border border-zinc-700 bg-[#111217] p-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex items-center gap-1 border-b border-zinc-800 bg-[#242429] px-2">
            {[
              ["testcase", "Testcase"],
              ["result", "Test Result"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tabButtonClass(rightBottomTab === key)}
                onClick={() => setRightBottomTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-[170px] overflow-auto bg-[#0f1014] p-4 text-sm">
            {rightBottomTab === "testcase" ? (
              <div className="space-y-2 text-zinc-300">
                <p className="font-semibold text-zinc-100">Submit Notes</p>
                <p>Use demo markers in code comments:</p>
                <pre className="mono rounded bg-black/40 p-3 text-xs text-zinc-200">
{`// OUTPUT: 3
// OUTPUT: 7`}
                </pre>
                {submitError ? <p className="text-rose-300">{submitError}</p> : null}
              </div>
            ) : null}

            {rightBottomTab === "result" ? (
              <div className="space-y-2 text-zinc-300">
                {!activeSubmission ? <p>No submission selected.</p> : null}
                {activeSubmission ? (
                  <>
                    <p className="text-zinc-100">
                      <span className="font-semibold">Submission:</span> #{activeSubmission.id}
                    </p>
                    <p>
                      <span className="font-semibold text-zinc-100">Status:</span>{" "}
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${statusPill(activeSubmission.status)}`}>
                        {activeSubmission.status}
                      </span>
                    </p>
                  </>
                ) : null}

                {activeResult ? (
                  <>
                    <p>
                      <span className="font-semibold text-zinc-100">Verdict:</span> {activeResult.verdict}
                    </p>
                    <p>
                      <span className="font-semibold text-zinc-100">Runtime:</span>{" "}
                      {activeResult.runtimeMs ?? 0} ms
                    </p>
                    {Array.isArray(activeResult.detailsJson) ? (
                      <p>
                        <span className="font-semibold text-zinc-100">Progress:</span>{" "}
                        {
                          activeResult.detailsJson.filter((item) => item.status === "PASSED").length
                        }
                        /
                        {activeResult.detailsJson.length} passed
                      </p>
                    ) : null}
                    <pre className="mono whitespace-pre-wrap rounded bg-black/40 p-3 text-xs text-zinc-200">
                      {JSON.stringify(activeResult.detailsJson, null, 2)}
                    </pre>
                  </>
                ) : null}

                {resultError ? <p className="text-rose-300">{resultError}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
