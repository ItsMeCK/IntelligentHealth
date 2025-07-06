// frontend/js/api.js
const API_BASE_URL = 'http://localhost:8000/api/v1';

const api = {
    // Debug function to check if API is loaded
    debug: () => {
        console.log('API loaded successfully');
        console.log('Available functions:', Object.keys(api));
    },
    // ... (previous functions are unchanged)
    register: (email, password, fullName, role) => {
        return fetch(`${API_BASE_URL}/users/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, full_name: fullName, role }), });
    },
    login: (email, password) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);
        return fetch(`${API_BASE_URL}/users/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData, });
    },
    getMe: (token) => {
        return fetch(`${API_BASE_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` }, });
    },
    getConsultations: (token) => {
        return fetch(`${API_BASE_URL}/consultations`, { headers: { 'Authorization': `Bearer ${token}` }, });
    },
    getConsultation: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}`, { headers: { 'Authorization': `Bearer ${token}` }, });
    },
    getReports: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/reports`, { headers: { 'Authorization': `Bearer ${token}` }, });
    },
    uploadReport: (formDataOrConsultationId, fileOrToken, tokenOrUndefined) => {
        // Handle both new and old API formats
        if (formDataOrConsultationId instanceof FormData) {
            // New format: uploadReport(formData, token)
            // Extract consultation_id from formData
            const consultationId = formDataOrConsultationId.get('consultation_id');
            if (!consultationId) {
                throw new Error('consultation_id is required in formData');
            }
            return fetch(`${API_BASE_URL}/consultations/${consultationId}/upload-report`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${fileOrToken}` }, 
                body: formDataOrConsultationId, 
            });
        } else {
            // Old format: uploadReport(consultationId, file, token)
            const formData = new FormData();
            formData.append('file', fileOrToken);
            return fetch(`${API_BASE_URL}/consultations/${formDataOrConsultationId}/upload-report`, { 
                method: 'POST', 
                headers: { 'Authorization': `Bearer ${tokenOrUndefined}` }, 
                body: formData, 
            });
        }
    },
    askAI: (consultationId, question, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({ question }), });
    },
    askQuestion: (consultationId, question, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`}, body: JSON.stringify({ question }), });
    },
    getDoctors: (token) => {
        return fetch(`${API_BASE_URL}/users/doctors`, { headers: { 'Authorization': `Bearer ${token}` }, });
    },
    createConsultation: (consultationData, token) => {
        return fetch(`${API_BASE_URL}/consultations`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(consultationData), });
    },

    // --- New Function for Phase 3 ---
    createNoteFromAudio: (consultationId, audioBlob, token) => {
        const formData = new FormData();
        // The third argument is the filename, which is required by FastAPI
        formData.append('file', audioBlob, 'consultation_audio.webm');

        return fetch(`${API_BASE_URL}/consultations/${consultationId}/create-note-from-audio`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });
    },
    processAudioRecording: (formData, token) => {
        return fetch(`${API_BASE_URL}/consultations/process-audio`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData,
        });
    },
    // --- New Function for Phase 5 ---
    generateDdx: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/generate-ddx`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },
    generateDifferentialDiagnosis: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/generate-ddx`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },
    // --- New Function for Patient History ---
    getPatientHistory: (patientId, token) => {
        return fetch(`${API_BASE_URL}/patients/${patientId}/history`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    // --- AI Chat Functions ---
    askAI: (consultationId, question, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/ask`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ question }),
        });
    },

    // --- Report Management Functions ---
    getConsultationReports: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/reports`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    downloadReport: (reportId, token) => {
        return fetch(`${API_BASE_URL}/reports/${reportId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    deleteReport: (reportId, token) => {
        return fetch(`${API_BASE_URL}/reports/${reportId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    // --- Report Summary Functions ---
    getReportSummaries: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/report-summaries`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },

    getReportDetails: (reportId, token) => {
        return fetch(`${API_BASE_URL}/reports/${reportId}/details`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },
    downloadReport: (reportId, token) => {
        return fetch(`${API_BASE_URL}/reports/${reportId}/download`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },
    deleteReport: (reportId, token) => {
        return fetch(`${API_BASE_URL}/reports/${reportId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
    },
    updateConsultationStatus: (consultationId, status, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status })
        });
    },

    // --- Patient Summary Functions ---
    generatePatientSummary: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/generate-summary`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    },

    updatePatientSummary: (consultationId, summaryData, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/update-summary`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(summaryData)
        });
    },

    getSummaryPDF: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/summary-pdf`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    },

    getSavedSummary: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/saved-summary`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    },
    getPatients: (token) => {
        return fetch(`${API_BASE_URL}/users/patients`, { headers: { 'Authorization': `Bearer ${token}` } });
    }
};

// Debug: Log when API is loaded
console.log('API module loaded');
console.log('Available functions:', Object.keys(api));

// Make sure API is available globally
if (typeof window !== 'undefined') {
    window.api = api;
    console.log('API made available globally');
}
