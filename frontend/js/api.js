// frontend/js/api.js
const API_BASE_URL = 'http://127.0.0.1:8000/api/v1';

const api = {
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
    getReports: (consultationId, token) => {
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/reports`, { headers: { 'Authorization': `Bearer ${token}` }, });
    },
    uploadReport: (consultationId, file, token) => {
        const formData = new FormData();
        formData.append('file', file);
        return fetch(`${API_BASE_URL}/consultations/${consultationId}/upload-report`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData, });
    },
    askAI: (consultationId, question, token) => {
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
    }
};
