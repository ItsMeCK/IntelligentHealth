// frontend/js/dashboard.js

// --- New: Modal and Form Elements ---
const createConsultationBtn = document.getElementById('create-consultation-btn');
const createConsultationModal = document.getElementById('create-consultation-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const createConsultationForm = document.getElementById('create-consultation-form');
const doctorSelect = document.getElementById('doctor-select');

async function loadDashboardData() {
    const token = localStorage.getItem('accessToken');
    const userName = localStorage.getItem('userName');
    const userRole = localStorage.getItem('userRole');

    if (!token) {
        document.getElementById('logout-btn').click();
        return;
    }

    // --- New: Show "Create" button only for patients ---
    if (userRole === 'patient') {
        createConsultationBtn.classList.remove('hidden');
    } else {
        createConsultationBtn.classList.add('hidden');
    }

    const userGreeting = document.getElementById('user-greeting');
    const consultationsList = document.getElementById('consultations-list');
    const loadingSpinner = document.getElementById('loading-spinner');

    userGreeting.textContent = `Welcome, ${userName || 'User'}!`;
    consultationsList.innerHTML = '';
    loadingSpinner.classList.remove('hidden');

    try {
        const response = await api.getConsultations(token);
        if (!response.ok) {
            throw new Error('Failed to fetch consultations.');
        }
        const consultations = await response.json();

        loadingSpinner.classList.add('hidden');

        if (consultations.length === 0) {
            consultationsList.innerHTML = `<p class="text-gray-500 col-span-full">You have no scheduled consultations.</p>`;
            return;
        }

        consultations.forEach(con => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                        <span class="px-3 py-1 text-xs font-semibold text-blue-800 bg-blue-100 rounded-full">${con.status}</span>
                        <span class="text-sm text-gray-500">${new Date(con.scheduled_time).toLocaleDateString()}</span>
                    </div>
                    <h3 class="text-lg font-bold text-gray-900">Consultation #${con.id}</h3>
                    <p class="mt-2 text-sm text-gray-600">
                        <span class="font-semibold">Doctor:</span> ${con.doctor.full_name}
                    </p>
                    <p class="text-sm text-gray-600">
                        <span class="font-semibold">Patient:</span> ${con.patient.full_name}
                    </p>
                    <div class="mt-6">
                        <a href="consultation.html?id=${con.id}" class="font-medium text-blue-600 hover:text-blue-500">View Details &rarr;</a>
                    </div>
                </div>
            `;
            consultationsList.appendChild(card);
        });

    } catch (error) {
        loadingSpinner.classList.add('hidden');
        consultationsList.innerHTML = `<p class="text-red-500 col-span-full">${error.message}</p>`;
    }
}

// --- New: Event Listeners for Modal ---
createConsultationBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // Fetch doctors and populate dropdown
    doctorSelect.innerHTML = '<option value="">Loading doctors...</option>';
    try {
        const response = await api.getDoctors(token);
        const doctors = await response.json();
        doctorSelect.innerHTML = '<option value="">Select a doctor</option>';
        doctors.forEach(doctor => {
            const option = document.createElement('option');
            option.value = doctor.id;
            option.textContent = doctor.full_name;
            doctorSelect.appendChild(option);
        });
    } catch (error) {
        doctorSelect.innerHTML = '<option value="">Could not load doctors</option>';
    }

    createConsultationModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    createConsultationModal.classList.add('hidden');
});

createConsultationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('accessToken');
    const patientId = localStorage.getItem('userId');

    const consultationData = {
        patient_id: parseInt(patientId),
        doctor_id: parseInt(doctorSelect.value),
        scheduled_time: document.getElementById('schedule-time-input').value,
        notes: document.getElementById('consultation-notes').value,
    };

    if (!consultationData.doctor_id || !consultationData.scheduled_time) {
        alert('Please select a doctor and a valid date/time.');
        return;
    }

    try {
        const response = await api.createConsultation(consultationData, token);
        if (!response.ok) {
            throw new Error('Failed to schedule consultation.');
        }
        createConsultationModal.classList.add('hidden');
        createConsultationForm.reset();
        loadDashboardData(); // Refresh the dashboard to show the new consultation
    } catch (error) {
        alert(error.message);
    }
});
