// frontend/js/dashboard.js

// Modern Dashboard JavaScript - MedFlow Platform

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const authView = document.getElementById('auth-view');
    const dashboardView = document.getElementById('dashboard-view');
    const sidebar = document.getElementById('sidebar');
    const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const navItems = document.querySelectorAll('.nav-item');
    const pageTitle = document.getElementById('page-title');
    const sections = document.querySelectorAll('[id$="-section"]');
    const createConsultationBtn = document.getElementById('create-consultation-btn');
    const createConsultationModal = document.getElementById('create-consultation-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const cancelModalBtn = document.getElementById('cancel-modal-btn');
    const createConsultationForm = document.getElementById('create-consultation-form');
    const doctorSelect = document.getElementById('doctor-select');
    const scheduleTimeInput = document.getElementById('schedule-time-input');
    const consultationNotes = document.getElementById('consultation-notes');
    const consultationsContainer = document.getElementById('consultations-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const userGreeting = document.getElementById('user-greeting');
    const logoutBtn = document.getElementById('logout-btn');

    // State Management
    let currentUser = null;
    let consultations = [];
    let doctors = [];
    let currentSection = 'overview';
    let charts = {};

    // Initialize Dashboard
    function initializeDashboard() {
        setupNavigation();
        setupModalHandlers();
        setupCharts();
        showDashboardLoading();
        loadDashboardData();
        setupSearchAndFilters();
    }

    // Navigation Setup
    function setupNavigation() {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.dataset.section;
                navigateToSection(section);
            });
        });

        // Mobile sidebar toggle
        mobileSidebarToggle?.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });

        sidebarToggle?.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 1024 && 
                !sidebar.contains(e.target) && 
                !mobileSidebarToggle.contains(e.target)) {
                sidebar.classList.add('-translate-x-full');
            }
        });
    }

    // Navigate to Section
    function navigateToSection(section) {
        // Update active nav item
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.section === section) {
                item.classList.add('active');
            }
        });

        // Hide all sections
        sections.forEach(s => s.classList.add('hidden'));

        // Show target section
        const targetSection = document.getElementById(`${section}-section`);
        if (targetSection) {
            targetSection.classList.remove('hidden');
        }

        // Update page title
        pageTitle.textContent = section.charAt(0).toUpperCase() + section.slice(1);

        // Load section-specific data
        currentSection = section;
        loadSectionData(section);
    }

    // Load Section Data
    function loadSectionData(section) {
        switch (section) {
            case 'overview':
                loadOverviewData();
                break;
            case 'consultations':
                loadConsultationsData();
                break;
            case 'patients':
                loadPatientsData();
                break;
            case 'reports':
                loadReportsData();
                break;
            case 'analytics':
                loadAnalyticsData();
                break;
        }
    }

    // Modal State Management
    let currentStep = 1;
    let totalSteps = 3;
    let selectedTimeSlot = null;
    let consultationData = {};

    // Modal Handlers
    function setupModalHandlers() {
        createConsultationBtn?.addEventListener('click', () => {
            showModal();
        });

        closeModalBtn?.addEventListener('click', hideModal);
        cancelModalBtn?.addEventListener('click', hideModal);

        // Close modal on backdrop click
        createConsultationModal?.addEventListener('click', (e) => {
            if (e.target === createConsultationModal) {
                hideModal();
            }
        });

        // Step navigation
        const nextStepBtn = document.getElementById('next-step-btn');
        const prevStepBtn = document.getElementById('prev-step-btn');
        const submitBtn = document.getElementById('submit-consultation-btn');

        nextStepBtn?.addEventListener('click', () => {
            if (validateCurrentStep()) {
                nextStep();
            }
        });

        prevStepBtn?.addEventListener('click', () => {
            previousStep();
        });

        submitBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            handleCreateConsultation();
        });

        // Handle form submission
        createConsultationForm?.addEventListener('submit', (e) => {
            e.preventDefault();
            handleCreateConsultation();
        });

        // Setup time slot selection
        setupTimeSlotHandlers();
    }

    // Show/Hide Modal
    function showModal() {
        createConsultationModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Animate modal in
        setTimeout(() => {
            const modalContent = document.getElementById('modal-content');
            modalContent.classList.remove('scale-95', 'opacity-0');
            modalContent.classList.add('modal-slide-in');
        }, 10);

        // Reset to first step
        currentStep = 1;
        consultationData = {};
        selectedTimeSlot = null;
        
        renderConsultationModalFields();
        updateStepIndicators();
        updateProgressBar();
        updateNavigationButtons();
        setupDateDefaults();
        generateTimeSlots();
    }

    function renderConsultationModalFields() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const fieldsContainer = document.getElementById('participant-fields');
        fieldsContainer.innerHTML = '';
        
        if (user.role === 'doctor') {
            // Doctor: show patient select and add new patient option
            fieldsContainer.innerHTML = `
                <div class="space-y-4">
                    <div class="space-y-2">
                        <label class="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                            <i data-lucide="user" class="h-4 w-4 text-blue-600"></i>
                            <span>Choose Patient</span>
                        </label>
                        <select id="patient-select" class="input-field-modern">
                            <option value="">Select a patient...</option>
                        </select>
                    </div>
                    <button type="button" id="add-new-patient-btn" class="btn-secondary-modern w-full">
                        <i data-lucide="plus" class="h-4 w-4 mr-2"></i>
                        <span>Add New Patient</span>
                    </button>
                    <div id="new-patient-fields" class="space-y-4 hidden p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <label class="text-sm font-semibold text-gray-700">Patient Name</label>
                                <input id="new-patient-name" type="text" class="input-field-modern" placeholder="Full Name">
                            </div>
                            <div class="space-y-2">
                                <label class="text-sm font-semibold text-gray-700">Patient Email</label>
                                <input id="new-patient-email" type="email" class="input-field-modern" placeholder="Email">
                            </div>
                        </div>
                    </div>
                </div>
            `;
            loadPatients();
            // Add toggle for new patient fields
            setTimeout(() => {
                const addPatientBtn = document.getElementById('add-new-patient-btn');
                if (addPatientBtn) {
                    addPatientBtn.onclick = () => {
                        const newPatientFields = document.getElementById('new-patient-fields');
                        newPatientFields.classList.toggle('hidden');
                        const icon = addPatientBtn.querySelector('i');
                        const span = addPatientBtn.querySelector('span');
                        if (newPatientFields.classList.contains('hidden')) {
                            icon.setAttribute('data-lucide', 'plus');
                            span.textContent = 'Add New Patient';
                        } else {
                            icon.setAttribute('data-lucide', 'minus');
                            span.textContent = 'Cancel';
                        }
                        lucide.createIcons();
                    };
                }
            }, 100);
        } else {
            // Patient: show doctor select
            fieldsContainer.innerHTML = `
                <div class="space-y-2">
                    <label class="text-sm font-semibold text-gray-700 flex items-center space-x-2">
                        <i data-lucide="user-check" class="h-4 w-4 text-blue-600"></i>
                        <span>Choose Doctor</span>
                    </label>
                    <select id="doctor-select" class="input-field-modern" required>
                        <option value="">Select a doctor...</option>
                    </select>
                </div>
            `;
            loadDoctors();
        }
    }

    function hideModal() {
        const modalContent = document.getElementById('modal-content');
        modalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            createConsultationModal.classList.add('hidden');
            document.body.style.overflow = 'auto';
            createConsultationForm.reset();
            currentStep = 1;
            consultationData = {};
            selectedTimeSlot = null;
        }, 300);
    }

    // Step Navigation
    function nextStep() {
        if (currentStep < totalSteps) {
            currentStep++;
            updateStepContent();
            updateStepIndicators();
            updateProgressBar();
            updateNavigationButtons();
        }
    }

    function previousStep() {
        if (currentStep > 1) {
            currentStep--;
            updateStepContent();
            updateStepIndicators();
            updateProgressBar();
            updateNavigationButtons();
        }
    }

    function updateStepContent() {
        // Hide all steps
        document.querySelectorAll('.step-content').forEach(step => {
            step.classList.add('hidden');
            step.classList.remove('active');
        });

        // Show current step
        const currentStepElement = document.getElementById(`step-${currentStep}`);
        if (currentStepElement) {
            currentStepElement.classList.remove('hidden');
            currentStepElement.classList.add('active');
        }

        // Special handling for step 3 (confirmation)
        if (currentStep === 3) {
            generateConsultationSummary();
        }
    }

    function updateStepIndicators() {
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            const stepNumber = index + 1;
            indicator.classList.remove('active', 'completed');
            
            if (stepNumber < currentStep) {
                indicator.classList.add('completed');
            } else if (stepNumber === currentStep) {
                indicator.classList.add('active');
            }
        });
    }

    function updateProgressBar() {
        const progress = ((currentStep - 1) / (totalSteps - 1)) * 100;
        document.querySelectorAll('.progress-bar').forEach(bar => {
            bar.style.width = `${progress}%`;
        });
    }

    function updateNavigationButtons() {
        const nextBtn = document.getElementById('next-step-btn');
        const prevBtn = document.getElementById('prev-step-btn');
        const submitBtn = document.getElementById('submit-consultation-btn');

        if (currentStep === 1) {
            prevBtn.classList.add('hidden');
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        } else if (currentStep === totalSteps) {
            prevBtn.classList.remove('hidden');
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            prevBtn.classList.remove('hidden');
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        }
    }

    function validateCurrentStep() {
        switch (currentStep) {
            case 1:
                return validateStep1();
            case 2:
                return validateStep2();
            case 3:
                return validateStep3();
            default:
                return true;
        }
    }

    function validateStep1() {
        const consultationType = document.getElementById('consultation-type').value;
        const reason = document.getElementById('consultation-reason').value.trim();
        
        if (!consultationType) {
            showNotification('Please select a consultation type', 'error');
            return false;
        }
        
        if (!reason) {
            showNotification('Please provide a reason for the visit', 'error');
            return false;
        }

        // Save step 1 data
        consultationData.step1 = {
            type: consultationType,
            duration: document.getElementById('consultation-duration').value,
            reason: reason,
            notes: document.getElementById('consultation-notes').value.trim()
        };

        return true;
    }

    function validateStep2() {
        const preferredDate = document.getElementById('preferred-date').value;
        const preferredTime = document.getElementById('preferred-time').value;
        const location = document.getElementById('consultation-location').value;
        
        if (!preferredDate || !preferredTime) {
            showNotification('Please select a preferred date and time', 'error');
            return false;
        }

        if (!selectedTimeSlot) {
            showNotification('Please select an available time slot', 'error');
            return false;
        }

        // Save step 2 data
        consultationData.step2 = {
            date: preferredDate,
            time: preferredTime,
            selectedSlot: selectedTimeSlot,
            location: location
        };

        return true;
    }

    function validateStep3() {
        const confirmTerms = document.getElementById('confirm-terms').checked;
        
        if (!confirmTerms) {
            showNotification('Please confirm the terms and conditions', 'error');
            return false;
        }

        return true;
    }

    // Load Doctors
    async function loadDoctors() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await api.getDoctors(token);
            if (!response.ok) throw new Error('Failed to load doctors');

            doctors = await response.json();
            doctorSelect.innerHTML = '<option value="">Select a doctor...</option>';
            doctors.forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor.id;
                option.textContent = doctor.full_name;
                doctorSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading doctors:', error);
            showNotification('Failed to load doctors', 'error');
        }
    }



    // Setup Charts
    function setupCharts() {
        // Consultation Trends Chart
        const consultationCtx = document.getElementById('consultation-chart')?.getContext('2d');
        if (consultationCtx) {
            charts.consultation = new Chart(consultationCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Consultations',
                        data: [12, 19, 3, 5, 2, 3],
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        }

        // Patient Distribution Chart
        const patientCtx = document.getElementById('patient-chart')?.getContext('2d');
        if (patientCtx) {
            charts.patient = new Chart(patientCtx, {
                type: 'doughnut',
                data: {
                    labels: ['New Patients', 'Returning Patients', 'Follow-ups'],
                    datasets: [{
                        data: [300, 150, 100],
                        backgroundColor: [
                            'rgb(59, 130, 246)',
                            'rgb(16, 185, 129)',
                            'rgb(245, 158, 11)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
    }

    // Show/Hide Dashboard Loading Spinner
    function showDashboardLoading() {
        document.getElementById('dashboard-loading-spinner')?.classList.remove('hidden');
        document.getElementById('dashboard-content')?.classList.add('hidden');
    }
    function hideDashboardLoading() {
        document.getElementById('dashboard-loading-spinner')?.classList.add('hidden');
        document.getElementById('dashboard-content')?.classList.remove('hidden');
    }

    // Load Dashboard Data
    async function loadDashboardData() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await api.getConsultations(token);
            if (!response.ok) throw new Error('Failed to load consultations');
            consultations = await response.json();
            updateDashboardStats();
            loadRecentConsultations();
            loadUpcomingAppointments();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showNotification('Failed to load dashboard data', 'error');
        } finally {
            hideDashboardLoading();
        }
    }

    // Update Dashboard Stats
    function updateDashboardStats() {
        const totalConsultations = consultations.length;
        const activePatients = new Set(consultations.map(c => c.patient.id)).size;
        const pendingConsultations = consultations.filter(c => c.status === 'scheduled').length;
        const reportsProcessed = consultations.reduce((total, c) => total + (c.reports?.length || 0), 0);

        document.getElementById('total-consultations').textContent = totalConsultations;
        document.getElementById('active-patients').textContent = activePatients;
        document.getElementById('pending-consultations').textContent = pendingConsultations;
        document.getElementById('reports-processed').textContent = reportsProcessed;
    }

    // Load Recent Consultations
    function loadRecentConsultations() {
        const recentContainer = document.getElementById('recent-consultations');
        if (!recentContainer) return;

        const recent = consultations.slice(0, 5);
        recentContainer.innerHTML = '';

        recent.forEach(consultation => {
            const patientName = consultation.patient?.full_name || 'Unknown Patient';
            const scheduled = consultation.scheduled_time ? new Date(consultation.scheduled_time).toLocaleDateString() : '';
            const status = consultation.status ? consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1) : '';
            const viewBtn = consultation.id ? `<button class="btn-primary btn-xs flex items-center space-x-2 px-3 py-1 ml-4" onclick="window.location.href='consultation.html?id=${consultation.id}'"><i data-lucide=\"arrow-right-circle\" class=\"h-4 w-4\"></i><span>View</span></button>` : '';
            const div = document.createElement('div');
            div.className = 'flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors';
            div.innerHTML = `
                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <i data-lucide="calendar" class="h-5 w-5 text-blue-600"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">${patientName}</p>
                    <p class="text-xs text-gray-500">${scheduled}</p>
                </div>
                <span class="status-badge status-${consultation.status}">${status}</span>
                ${viewBtn}
            `;
            recentContainer.appendChild(div);
        });

        lucide.createIcons();
    }

    // Load Upcoming Appointments
    function loadUpcomingAppointments() {
        const upcomingContainer = document.getElementById('upcoming-appointments');
        if (!upcomingContainer) return;

        const upcoming = consultations
            .filter(c => c.status === 'scheduled' && new Date(c.scheduled_time) > new Date())
            .slice(0, 5);

        upcomingContainer.innerHTML = '';

        upcoming.forEach(consultation => {
            const div = document.createElement('div');
            div.className = 'flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors';
            div.innerHTML = `
                <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <i data-lucide="clock" class="h-5 w-5 text-green-600"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 truncate">${consultation.patient.full_name}</p>
                    <p class="text-xs text-gray-500">${new Date(consultation.scheduled_time).toLocaleString()}</p>
                </div>
            `;
            upcomingContainer.appendChild(div);
        });

        lucide.createIcons();
    }

    // Load Consultations Data
    function loadConsultationsData() {
        if (currentSection !== 'consultations') return;
        showLoading();
        setTimeout(() => {
            renderConsultations();
            hideLoading();
        }, 500);
    }

    // Render Consultations
    function renderConsultations() {
        if (!consultationsContainer) return;

        consultationsContainer.innerHTML = '';

        if (consultations.length === 0) {
            consultationsContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="calendar-x" class="empty-state-icon"></i>
                    <h3 class="empty-state-title">No consultations found</h3>
                    <p class="empty-state-description">Get started by creating your first consultation.</p>
                    <button class="btn-primary">Create Consultation</button>
                </div>
            `;
            return;
        }

        consultations.forEach(consultation => {
            const card = createConsultationCard(consultation);
            consultationsContainer.appendChild(card);
        });

        lucide.createIcons();
    }

    // Create Consultation Card
    function createConsultationCard(consultation) {
        const card = document.createElement('div');
        card.className = 'consultation-card';
        card.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-start space-x-4">
                    <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                        <i data-lucide="user" class="h-6 w-6 text-white"></i>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-lg font-semibold text-gray-900">${consultation.patient.full_name}</h4>
                        <p class="text-sm text-gray-600">with Dr. ${consultation.doctor.full_name}</p>
                        <p class="text-xs text-gray-500 mt-1">${new Date(consultation.scheduled_time).toLocaleString()}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <button class="status-badge status-${consultation.status} px-4 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 cursor-default" disabled>${consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1)}</button>
                    <button class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" aria-label="More options">
                        <i data-lucide="more-vertical" class="h-4 w-4"></i>
                    </button>
                </div>
            </div>
            ${consultation.notes ? `<p class="text-sm text-gray-600 mt-4">${consultation.notes}</p>` : ''}
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div class="flex items-center space-x-4 text-sm text-gray-500">
                    <span class="flex items-center space-x-1">
                        <i data-lucide="file-text" class="h-4 w-4"></i>
                        <span>${consultation.reports?.length || 0} reports</span>
                    </span>
                </div>
                <button class="btn-primary text-sm flex items-center space-x-2 px-4 py-2" onclick="window.location.href='consultation.html?id=${consultation.id}'">
                    <i data-lucide="arrow-right-circle" class="h-4 w-4"></i>
                    <span>View Details</span>
                </button>
            </div>
        `;
        return card;
    }

    // Setup Search and Filters
    function setupSearchAndFilters() {
        const searchInput = document.querySelector('input[placeholder*="Search"]');
        const filterSelect = document.querySelector('select');

        searchInput?.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            filterConsultations(query);
        });

        filterSelect?.addEventListener('change', (e) => {
            const status = e.target.value;
            filterConsultations('', status);
        });
    }

    // Filter Consultations
    function filterConsultations(query = '', status = '') {
        const filtered = consultations.filter(consultation => {
            const matchesQuery = !query || 
                consultation.patient.full_name.toLowerCase().includes(query) ||
                consultation.doctor.full_name.toLowerCase().includes(query);
            
            const matchesStatus = !status || status === 'All Status' || consultation.status === status.toLowerCase();
            
            return matchesQuery && matchesStatus;
        });

        renderFilteredConsultations(filtered);
    }

    // Render Filtered Consultations
    function renderFilteredConsultations(consultations) {
        if (!consultationsContainer) return;

        consultationsContainer.innerHTML = '';

        consultations.forEach(consultation => {
            const card = createConsultationCard(consultation);
            consultationsContainer.appendChild(card);
        });

        lucide.createIcons();
    }

    // Show/Hide Loading
    function showLoading() {
        loadingSpinner?.classList.remove('hidden');
    }

    function hideLoading() {
        loadingSpinner?.classList.add('hidden');
    }

    // Notification System
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} animate-fade-in-up`;
        notification.innerHTML = `
            <div class="flex items-center space-x-3">
                <i data-lucide="${getNotificationIcon(type)}" class="h-5 w-5"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 200);
        }, 5000);

        lucide.createIcons();
    }

    function getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'check-circle';
            case 'error': return 'x-circle';
            case 'warning': return 'alert-triangle';
            default: return 'info';
        }
    }

    // Load Other Section Data (Placeholder)
    function loadPatientsData() {
        // TODO: Implement patients section
        console.log('Loading patients data...');
    }

    function loadReportsData() {
        // TODO: Implement reports section
        console.log('Loading reports data...');
    }

    function loadAnalyticsData() {
        // TODO: Implement analytics section
        console.log('Loading analytics data...');
    }

    // Multi-step Modal Helper Functions
    function setupDateDefaults() {
        const dateInput = document.getElementById('preferred-date');
        if (dateInput) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateInput.value = tomorrow.toISOString().split('T')[0];
            dateInput.min = tomorrow.toISOString().split('T')[0];
        }

        const timeInput = document.getElementById('preferred-time');
        if (timeInput) {
            timeInput.value = '09:00';
        }
    }

    function generateTimeSlots() {
        const timeSlotsContainer = document.getElementById('time-slots');
        if (!timeSlotsContainer) return;

        const slots = [
            '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
        ];

        timeSlotsContainer.innerHTML = '';
        slots.forEach(slot => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'time-slot-btn';
            button.textContent = slot;
            button.dataset.time = slot;
            button.onclick = () => selectTimeSlot(slot, button);
            timeSlotsContainer.appendChild(button);
        });
    }

    function selectTimeSlot(time, button) {
        // Remove selection from all buttons
        document.querySelectorAll('.time-slot-btn').forEach(btn => {
            btn.classList.remove('selected');
        });

        // Select the clicked button
        button.classList.add('selected');
        selectedTimeSlot = time;

        // Update the preferred time input
        const timeInput = document.getElementById('preferred-time');
        if (timeInput) {
            timeInput.value = time;
        }
    }

    function setupTimeSlotHandlers() {
        // Handle date change to regenerate time slots
        const dateInput = document.getElementById('preferred-date');
        if (dateInput) {
            dateInput.addEventListener('change', () => {
                generateTimeSlots();
                selectedTimeSlot = null;
            });
        }
    }

    function generateConsultationSummary() {
        const summaryContainer = document.getElementById('consultation-summary');
        if (!summaryContainer) return;

        const step1 = consultationData.step1;
        const step2 = consultationData.step2;

        if (!step1 || !step2) return;

        const consultationTypes = {
            'general': 'General Checkup',
            'specialist': 'Specialist Consultation',
            'followup': 'Follow-up Visit',
            'emergency': 'Emergency Visit',
            'routine': 'Routine Examination'
        };

        const locations = {
            'clinic': 'Main Clinic',
            'video': 'Video Consultation',
            'home': 'Home Visit'
        };

        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const patientName = user.role === 'doctor' ? 
            (document.getElementById('patient-select')?.selectedOptions[0]?.text || 'New Patient') :
            user.full_name;

        summaryContainer.innerHTML = `
            <div class="consultation-summary-item">
                <span class="consultation-summary-label">Consultation Type:</span>
                <span class="consultation-summary-value">${consultationTypes[step1.type] || step1.type}</span>
            </div>
            <div class="consultation-summary-item">
                <span class="consultation-summary-label">Duration:</span>
                <span class="consultation-summary-value">${step1.duration} minutes</span>
            </div>
            <div class="consultation-summary-item">
                <span class="consultation-summary-label">Patient:</span>
                <span class="consultation-summary-value">${patientName}</span>
            </div>
            <div class="consultation-summary-item">
                <span class="consultation-summary-label">Date & Time:</span>
                <span class="consultation-summary-value">${new Date(step2.date + 'T' + step2.selectedSlot).toLocaleString()}</span>
            </div>
            <div class="consultation-summary-item">
                <span class="consultation-summary-label">Location:</span>
                <span class="consultation-summary-value">${locations[step2.location] || step2.location}</span>
            </div>
            <div class="consultation-summary-item">
                <span class="consultation-summary-label">Reason:</span>
                <span class="consultation-summary-value">${step1.reason}</span>
            </div>
            ${step1.notes ? `
            <div class="consultation-summary-item">
                <span class="consultation-summary-label">Notes:</span>
                <span class="consultation-summary-value">${step1.notes}</span>
            </div>
            ` : ''}
        `;
    }

    // Updated handleCreateConsultation for multi-step modal
    async function handleCreateConsultation() {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        let formData = {};

        try {
            if (user.role === 'doctor') {
                const patientSelect = document.getElementById('patient-select');
                const newPatientFields = document.getElementById('new-patient-fields');
                let patientId = patientSelect.value;

                // If new patient fields are visible and filled, create new patient
                if (!patientId && !newPatientFields.classList.contains('hidden')) {
                    const name = document.getElementById('new-patient-name').value.trim();
                    const email = document.getElementById('new-patient-email').value.trim();
                    if (!name || !email) {
                        showNotification('Please enter patient name and email', 'error');
                        return;
                    }
                    // Create new patient
                    const token = localStorage.getItem('accessToken');
                    const response = await api.register(email, 'defaultpassword', name, 'patient');
                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to create patient');
                    }
                    const newPatient = await response.json();
                    patientId = newPatient.id;
                    showNotification('New patient created!', 'success');
                }

                if (!patientId) {
                    showNotification('Please select or create a patient', 'error');
                    return;
                }

                formData = {
                    patient_id: parseInt(patientId),
                    doctor_id: user.id,
                    scheduled_time: consultationData.step2.date + 'T' + consultationData.step2.selectedSlot,
                    notes: consultationData.step1.notes + '\n\nReason: ' + consultationData.step1.reason
                };
            } else {
                // Patient flow
                const doctorSelect = document.getElementById('doctor-select');
                if (!doctorSelect.value) {
                    showNotification('Please select a doctor', 'error');
                    return;
                }

                formData = {
                    doctor_id: parseInt(doctorSelect.value),
                    scheduled_time: consultationData.step2.date + 'T' + consultationData.step2.selectedSlot,
                    notes: consultationData.step1.notes + '\n\nReason: ' + consultationData.step1.reason
                };
            }

            const token = localStorage.getItem('accessToken');
            const response = await api.createConsultation(formData, token);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to create consultation');
            }

            const consultation = await response.json();
            hideModal();
            showNotification('Consultation created successfully!', 'success');
            
            // Dynamically update the list
            if (currentSection === 'consultations') {
                await loadConsultationsData();
            } else {
                await loadDashboardData();
            }
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }

    // Initialize when user is authenticated
    if (localStorage.getItem('accessToken')) {
        authView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        
        // Set user greeting
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        userGreeting.textContent = `Hello, ${user.full_name || 'User'}`;
        
        // Show create consultation button for patients and doctors
        if (user.role === 'patient' || user.role === 'doctor') {
            createConsultationBtn?.classList.remove('hidden');
        }
        
        initializeDashboard();
    }

    // Logout handler
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.reload();
    });

    async function loadPatients() {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await api.getPatients(token);
            if (!response.ok) throw new Error('Failed to load patients');
            const patients = await response.json();
            const patientSelect = document.getElementById('patient-select');
            patientSelect.innerHTML = '<option value="">Select a patient...</option>';
            patients.forEach(patient => {
                const option = document.createElement('option');
                option.value = patient.id;
                option.textContent = `${patient.full_name} (${patient.email})`;
                patientSelect.appendChild(option);
            });
        } catch (error) {
            showNotification('Failed to load patients', 'error');
        }
    }
});
