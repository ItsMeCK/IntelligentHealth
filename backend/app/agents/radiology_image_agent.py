# backend/app/agents/radiology_image_agent.py
"""
Expert Radiologist Co-Pilot: Advanced Medical Image Analysis Workflow
Implements a multi-step LangGraph workflow using OpenAI's latest vision and text models.
"""

from typing import Any, Dict, List
import os
import openai
import base64
import json
import logging
import re

# Placeholder for OpenAI and LangGraph imports
# from openai import OpenAI
# import langgraph

logger = logging.getLogger("radiology_agent")
logger.setLevel(logging.INFO)

class RadiologyImageAgent:
    def __init__(self, image_path: str):
        self.image_path = image_path
        self.state = {
            'image_path': image_path,
            'modality': None,
            'body_part': None,
            'diagnostic_quality': None,
            'triage_comments': None,
            'anomalies': [],
            'characterizations': [],
            'differential_diagnosis': [],
            'final_report': None,
            'progress': [],
            'intermediate_outputs': {}
        }
        openai.api_key = os.getenv('OPENAI_API_KEY')
        logger.info(f"Initialized RadiologyImageAgent for image: {image_path}")

    def run_workflow(self) -> dict:
        logger.info("--- Starting radiology workflow ---")
        self._node1_image_triage()
        self._node2_anomaly_detection()
        if self.state['anomalies'] == "No significant abnormalities detected":
            logger.info("No significant abnormalities detected. Skipping characterization and DDx.")
            self.state['final_report'] = self._node6_report_synthesis()
            self.state['progress'].append('No significant abnormalities detected. Workflow complete.')
            logger.info("--- Workflow complete ---")
            return self.state
        self._node4_anomaly_characterization()
        self._node5_differential_diagnosis()
        self.state['final_report'] = self._node6_report_synthesis()
        self.state['progress'].append('Workflow complete.')
        logger.info("--- Workflow complete ---")
        return self.state

    def _image_to_base64(self):
        with open(self.image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    def extract_json_from_response(self, content):
        if not content:
            return None
        content = content.strip()
        # Remove ```json ... ``` or ``` ... ```
        if content.startswith('```'):
            content = re.sub(r'^```[a-zA-Z]*\n', '', content)
            content = re.sub(r'\n```$', '', content)
            content = content.strip('`').strip()
        return content

    def _node1_image_triage(self):
        logger.info("[Node 1] Image Triage & Classification: Entered")
        prompt = (
            "You are an expert radiologist. You will be shown a medical image.\n"
            "Classify the image by:\n"
            "1. Imaging modality (e.g., MRI, CT, X-ray, Ultrasound, etc.)\n"
            "2. Body part/region (e.g., Brain, Chest, Abdomen, etc.)\n"
            "3. Is the image of diagnostic quality? (Yes/No, with reason if No)\n"
            "Return your answer as a JSON object with keys: 'modality', 'body_part', 'diagnostic_quality', 'comments'. Respond ONLY with valid JSON."
        )
        try:
            image_b64 = self._image_to_base64()
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                    ]}
                ],
                max_tokens=512
            )
            content = response.choices[0].message.content
            logger.info(f"[Node 1] Raw content: {content!r}")
            if not content:
                logger.error("[Node 1] Empty response from OpenAI")
                self.state['progress'].append('Image triage failed: Empty response from OpenAI')
                self.state['intermediate_outputs']['triage'] = {'error': 'Empty response from OpenAI'}
                return
            clean_content = self.extract_json_from_response(content)
            try:
                result = json.loads(clean_content)
            except Exception as e:
                logger.error(f"[Node 1] Failed to parse JSON: {e}. Content: {clean_content!r}")
                self.state['progress'].append(f'Image triage failed: Could not parse JSON: {e}')
                self.state['intermediate_outputs']['triage'] = {'error': f'Could not parse JSON: {e}', 'raw': content}
                return
            self.state['modality'] = result.get('modality')
            self.state['body_part'] = result.get('body_part')
            self.state['diagnostic_quality'] = result.get('diagnostic_quality')
            self.state['triage_comments'] = result.get('comments')
            self.state['progress'].append('Image triaged and classified.')
            self.state['intermediate_outputs']['triage'] = result
            logger.info(f"[Node 1] Output: {result}")
        except Exception as e:
            self.state['progress'].append(f'Image triage failed: {e}')
            self.state['modality'] = None
            self.state['body_part'] = None
            self.state['diagnostic_quality'] = None
            self.state['triage_comments'] = str(e)
            self.state['intermediate_outputs']['triage'] = {'error': str(e)}
            logger.error(f"[Node 1] Error: {e}")

    def _node2_anomaly_detection(self):
        logger.info("[Node 2] Anomaly Detection: Entered")
        prompt = (
            f"You are an expert radiologist. Analyze this {self.state['body_part']} {self.state['modality']} image. "
            "Identify and list any potential anomalies, abnormalities, or deviations from normal anatomy. "
            "Respond ONLY with a valid JSON array of findings. If none are found, respond with an empty array ([]). "
            "Do not include any other text or formatting."
        )
        try:
            image_b64 = self._image_to_base64()
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}},
                    ]}
                ],
                max_tokens=512
            )
            content = response.choices[0].message.content
            logger.info(f"[Node 2] Raw content: {content!r}")
            if not content:
                logger.error("[Node 2] Empty response from OpenAI")
                self.state['progress'].append('Anomaly detection failed: Empty response from OpenAI')
                self.state['intermediate_outputs']['anomaly_detection'] = {'error': 'Empty response from OpenAI'}
                return
            clean_content = self.extract_json_from_response(content)
            try:
                findings = json.loads(clean_content)
                if not isinstance(findings, list):
                    logger.warning("[Node 2] Findings is not a list, treating as no findings.")
                    findings = []
            except Exception as e:
                logger.error(f"[Node 2] Failed to parse JSON: {e}. Content: {clean_content!r}")
                findings = []
            self.state['anomalies'] = findings
            self.state['progress'].append('Anomaly detection complete.')
            self.state['intermediate_outputs']['anomaly_detection'] = findings
            logger.info(f"[Node 2] Output: {findings}")
        except Exception as e:
            self.state['progress'].append(f'Anomaly detection failed: {e}')
            self.state['anomalies'] = []
            self.state['intermediate_outputs']['anomaly_detection'] = {'error': str(e)}
            logger.error(f"[Node 2] Error: {e}")

    def _node4_anomaly_characterization(self):
        logger.info("[Node 4] Anomaly Characterization: Entered")
        self.state['characterizations'] = []
        chars = []
        for anomaly in self.state['anomalies']:
            prompt = (
                f"You are an expert radiologist. For the finding: '{anomaly}', provide a detailed characterization including:\n"
                "- Estimated size in millimeters\n"
                "- Shape and margins\n"
                f"- Location within the {self.state['body_part']}\n"
                "- Any mass effect or impact on surrounding structures\n"
                "Return your answer as a JSON object with keys: 'size_mm', 'shape_margins', 'location', 'mass_effect', 'additional_notes'. Respond ONLY with valid JSON."
            )
            try:
                response = openai.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": prompt}
                    ],
                    max_tokens=512
                )
                content = response.choices[0].message.content
                logger.info(f"[Node 4] Raw content for '{anomaly}': {content!r}")
                if not content:
                    logger.error(f"[Node 4] Empty response for '{anomaly}' from OpenAI")
                    chars.append({'finding': anomaly, 'error': 'Empty response from OpenAI'})
                    continue
                clean_content = self.extract_json_from_response(content)
                try:
                    char = json.loads(clean_content)
                except Exception as e:
                    logger.error(f"[Node 4] Failed to parse JSON for '{anomaly}': {e}. Content: {clean_content!r}")
                    chars.append({'finding': anomaly, 'error': f'Could not parse JSON: {e}', 'raw': content})
                    continue
                char['finding'] = anomaly
                chars.append(char)
                logger.info(f"[Node 4] Output for '{anomaly}': {char}")
            except Exception as e:
                chars.append({'finding': anomaly, 'error': str(e)})
                logger.error(f"[Node 4] Error for '{anomaly}': {e}")
        self.state['characterizations'] = chars
        self.state['progress'].append('Anomaly characterization complete.')
        self.state['intermediate_outputs']['characterizations'] = chars

    def _node5_differential_diagnosis(self):
        logger.info("[Node 5] Differential Diagnosis: Entered")
        prompt = (
            "You are an expert radiologist. Given the following findings: "
            f"{self.state['characterizations']}, what are the most likely differential diagnoses? "
            "Rank them in order of probability and provide a brief rationale for each. "
            "Return your answer as a JSON array of objects with keys: 'diagnosis', 'probability_rank', 'rationale'. Respond ONLY with valid JSON."
        )
        try:
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": prompt}
                ],
                max_tokens=512
            )
            content = response.choices[0].message.content
            logger.info(f"[Node 5] Raw content: {content!r}")
            if not content:
                logger.error("[Node 5] Empty response from OpenAI")
                self.state['progress'].append('Differential diagnosis failed: Empty response from OpenAI')
                self.state['intermediate_outputs']['differential_diagnosis'] = {'error': 'Empty response from OpenAI'}
                return
            clean_content = self.extract_json_from_response(content)
            try:
                ddx = json.loads(clean_content)
            except Exception as e:
                logger.error(f"[Node 5] Failed to parse JSON: {e}. Content: {clean_content!r}")
                self.state['progress'].append(f'Differential diagnosis failed: Could not parse JSON: {e}')
                self.state['intermediate_outputs']['differential_diagnosis'] = {'error': f'Could not parse JSON: {e}', 'raw': content}
                return
            self.state['differential_diagnosis'] = ddx
            self.state['progress'].append('Differential diagnosis complete.')
            self.state['intermediate_outputs']['differential_diagnosis'] = ddx
            logger.info(f"[Node 5] Output: {ddx}")
        except Exception as e:
            self.state['differential_diagnosis'] = []
            self.state['progress'].append(f'Differential diagnosis failed: {e}')
            self.state['intermediate_outputs']['differential_diagnosis'] = {'error': str(e)}
            logger.error(f"[Node 5] Error: {e}")

    def _node6_report_synthesis(self):
        logger.info("[Node 6] Final Report Synthesis: Entered")
        prompt = (
            "You are an expert radiologist. Synthesize a formal radiology report using the following data:\n"
            f"Findings: {self.state['characterizations']}\n"
            f"Differential Diagnoses: {self.state['differential_diagnosis']}\n"
            "Structure the report with clear 'Findings' and 'Impression' sections, using professional radiology language. Respond ONLY with valid text."
        )
        try:
            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": prompt}
                ],
                max_tokens=512
            )
            content = response.choices[0].message.content
            logger.info(f"[Node 6] Raw content: {content!r}")
            if not content:
                logger.error("[Node 6] Empty response from OpenAI")
                self.state['progress'].append('Report synthesis failed: Empty response from OpenAI')
                self.state['intermediate_outputs']['final_report'] = {'error': 'Empty response from OpenAI'}
                return "Report synthesis failed: Empty response from OpenAI"
            self.state['progress'].append('Final report synthesized.')
            self.state['intermediate_outputs']['final_report'] = content
            logger.info(f"[Node 6] Output: {content}")
            return content
        except Exception as e:
            self.state['progress'].append(f'Report synthesis failed: {e}')
            self.state['intermediate_outputs']['final_report'] = {'error': str(e)}
            logger.error(f"[Node 6] Error: {e}")
            return f"Report synthesis failed: {e}" 