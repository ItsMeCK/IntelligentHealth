# backend/app/agents/graph_builder.py

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List
import operator
from app.agents.nodes.scribe_nodes import ScribeNodes
# --- New for Phase 5 ---
from app.agents.nodes.diagnosis_nodes import DiagnosisNodes

class ScribeState(TypedDict):
    """State for the Scribe agent."""
    consultation_id: int
    audio_file_path: str
    transcription: str
    structured_summary: dict
    final_note: str
    error: str

# --- New State for Phase 5 ---
class DdxState(TypedDict):
    """State for the Differential Diagnosis agent."""
    consultation_id: int
    patient_data_context: str
    ddx_result: str
    error: str

class AgentGraphs:
    """
    Builds and compiles all LangGraph agents for the application.
    """
    def __init__(self):
        # Scribe Agent
        self.scribe_workflow = StateGraph(ScribeState)
        self._build_scribe_graph()
        self.scribe_agent_runnable = self.scribe_workflow.compile()

        # DDx Agent
        self.ddx_workflow = StateGraph(DdxState)
        self._build_ddx_graph()
        self.ddx_agent_runnable = self.ddx_workflow.compile()

    def _build_scribe_graph(self):
        scribe_nodes = ScribeNodes()
        self.scribe_workflow.add_node("transcribe_audio", scribe_nodes.transcribe_audio)
        self.scribe_workflow.add_node("structure_transcript", scribe_nodes.structure_transcript)
        self.scribe_workflow.add_node("generate_soap_note", scribe_nodes.generate_soap_note)
        self.scribe_workflow.add_node("save_note", scribe_nodes.save_note)
        self.scribe_workflow.set_entry_point("transcribe_audio")
        self.scribe_workflow.add_edge("transcribe_audio", "structure_transcript")
        self.scribe_workflow.add_edge("structure_transcript", "generate_soap_note")
        self.scribe_workflow.add_edge("generate_soap_note", "save_note")
        self.scribe_workflow.add_edge("save_note", END)

    def _build_ddx_graph(self):
        diagnosis_nodes = DiagnosisNodes()
        self.ddx_workflow.add_node("gather_patient_data", diagnosis_nodes.gather_patient_data)
        self.ddx_workflow.add_node("generate_ddx_report", diagnosis_nodes.generate_ddx_report)
        self.ddx_workflow.add_node("save_ddx_result", diagnosis_nodes.save_ddx_result)
        self.ddx_workflow.set_entry_point("gather_patient_data")
        self.ddx_workflow.add_edge("gather_patient_data", "generate_ddx_report")
        self.ddx_workflow.add_edge("generate_ddx_report", "save_ddx_result")
        self.ddx_workflow.add_edge("save_ddx_result", END)


# Instantiate the graph builder to make runnables available for import
agent_graphs = AgentGraphs()
scribe_agent_runnable = agent_graphs.scribe_agent_runnable
ddx_agent_runnable = agent_graphs.ddx_agent_runnable
