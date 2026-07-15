// Shared state between modules - attached to window to ensure true sharing across scripts
window.startAgentPending = window.startAgentPending ?? false;
window.isStopping = window.isStopping ?? false;
window.lastRunningState = window.lastRunningState ?? false;
window.lastNetworkState = window.lastNetworkState ?? null;
