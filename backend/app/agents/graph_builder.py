# backend/app/agents/graph_builder.py

from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List
import operator
from app.agents.nodes.scribe_nodes import ScribeNodes

class ScribeState(TypedDict):
    """
    Represents the state of our Scribe agent.
    """
    consultation_id: int
    audio_file_path: str
    transcription: str
    structured_summary: dict
    final_note: str
    error: str

class ScribeGraph:
    """
    Builds and compiles the LangGraph for the Ambient Scribe agent.
    """
    def __init__(self):
        self.workflow = StateGraph(ScribeState)
        self._build_graph()

    def _build_graph(self):
        """
        Defines the nodes and edges of the agent's workflow.
        """
        scribe_nodes = ScribeNodes()

        # Define the nodes
        self.workflow.add_node("transcribe_audio", scribe_nodes.transcribe_audio)
        self.workflow.add_node("structure_transcript", scribe_nodes.structure_transcript)
        self.workflow.add_node("generate_soap_note", scribe_nodes.generate_soap_note)
        self.workflow.add_node("save_note", scribe_nodes.save_note)

        # Define the edges (the flow of the conversation)
        self.workflow.set_entry_point("transcribe_audio")
        self.workflow.add_edge("transcribe_audio", "structure_transcript")
        self.workflow.add_edge("structure_transcript", "generate_soap_note")
        self.workflow.add_edge("generate_soap_note", "save_note")
        self.workflow.add_edge("save_note", END)

    def get_runnable(self):
        """
        Compiles the graph into a runnable object.
        """
        return self.workflow.compile()

# Instantiate the graph builder and compile the runnable agent
scribe_agent_runnable = ScribeGraph().get_runnable()
