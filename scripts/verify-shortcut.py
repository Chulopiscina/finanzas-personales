"""Inspect compiled native actions before sending the public file to Apple."""
import plistlib
import re
import sys
from pathlib import Path

workflow = plistlib.loads(Path(sys.argv[1]).read_bytes())
actions = workflow["WFWorkflowActions"]
assert len(actions) > 30, "Incomplete workflow"
ids = [a["WFWorkflowActionIdentifier"] for a in actions]
assert ids.count("is.workflow.actions.downloadurl") == 4
assert "is.workflow.actions.setstoredcontent" in ids
assert "is.workflow.actions.getstoredcontent" in ids
assert "is.workflow.actions.setclipboard" not in ids
serialized = plistlib.dumps(workflow).decode()
assert not re.search(r"fp_[A-Za-z0-9_-]{43}|pair_[A-Za-z0-9_-]{43}", serialized)
assert "supabase" not in serialized.lower()
assert "WFWorkflowImportQuestions" in workflow and not workflow["WFWorkflowImportQuestions"]
for action in actions:
    p = action.get("WFWorkflowActionParameters", {})
    if action["WFWorkflowActionIdentifier"] == "is.workflow.actions.downloadurl":
        assert "https://finanzas-personales-lime-two.vercel.app" in str(p) or "origin" in str(p)
        assert p["WFHTTPMethod"] == "POST"
        assert p["WFHTTPBodyType"] == "JSON"
    if action["WFWorkflowActionIdentifier"].endswith("storedcontent"):
        assert not p.get("WFStoredContentGlobalValue"), "Credentials must not be global"
print(f"Native workflow inspected: {len(actions)} actions, no embedded credentials")
