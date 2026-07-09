(function () {
    'use strict';

    const API_BASE = '/api';
    let currentFilters = { status: 'all', priority: 'all', category: 'all', sort: 'created_at', search: '' };
    let deleteTaskId = null;
    let searchTimeout = null;
    let shownReminders = new Set();
    let reminderInterval = null;

    const PRIORITY_LABELS = { alta: 'Alta', media: 'Media', baja: 'Baja' };
    const CATEGORY_ICONS = {
        trabajo: 'bi-briefcase', universidad: 'bi-book', personal: 'bi-person',
        compras: 'bi-cart', salud: 'bi-heart-pulse', otras: 'bi-three-dots'
    };
    const REMINDER_LABELS = {
        '0': 'En el momento exacto', '5': '5 min antes', '15': '15 min antes',
        '30': '30 min antes', '60': '1 h antes', '1440': '1 día antes'
    };

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function api(url, options) {
        return fetch(API_BASE + url, {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            ...options
        }).then(function (r) {
            var ct = r.headers.get('content-type') || '';
            if (ct.indexOf('application/json') !== -1) {
                return r.json();
            }
            return r.text().then(function () {
                throw new Error('Respuesta no JSON: ' + r.status);
            });
        });
    }

    function showToast(message, type) {
        var container = $('.toast-container');
        if (!container) return;
        var toast = document.createElement('div');
        toast.className = 'toast-custom ' + (type || 'info');
        var icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill', warning: 'bi-exclamation-circle-fill' };
        toast.innerHTML = '<i class="bi ' + (icons[type] || icons.info) + '"></i><span>' + message + '</span><button class="toast-close">&times;</button>';
        container.appendChild(toast);
        toast.querySelector('.toast-close').addEventListener('click', function () { removeToast(toast); });
        setTimeout(function () { removeToast(toast); }, 4000);
    }

    function removeToast(toast) {
        if (!toast || toast.classList.contains('removing')) return;
        toast.classList.add('removing');
        setTimeout(function () { toast.remove(); }, 300);
    }

    function showLoading() {
        var el = $('#loadingIndicator');
        if (el) el.classList.remove('d-none');
        el = $('#tasksList');
        if (el) el.innerHTML = '';
        el = $('#emptyState');
        if (el) el.classList.add('d-none');
    }

    function hideLoading() {
        var el = $('#loadingIndicator');
        if (el) el.classList.add('d-none');
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var opts = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return d.toLocaleDateString('es-ES', opts);
    }

    function getDueDateClass(dueDateStr) {
        if (!dueDateStr) return '';
        var now = new Date();
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return '';
        var diffMs = due.getTime() - now.getTime();
        if (diffMs < 0) return 'overdue';
        if (diffMs < 3600000) return 'due-soon';
        if (diffMs < 86400000) return 'due-approaching';
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var dueDay = new Date(due);
        dueDay.setHours(0, 0, 0, 0);
        if (dueDay.getTime() === today.getTime()) return 'due-today';
        return '';
    }

    function getCardBorderClass(dueDateStr) {
        if (!dueDateStr) return '';
        var now = new Date();
        var due = new Date(dueDateStr);
        if (isNaN(due.getTime())) return '';
        var diffMs = due.getTime() - now.getTime();
        if (diffMs < 0) return 'overdue-border';
        if (diffMs < 3600000) return 'due-soon-border';
        if (diffMs < 86400000) return 'due-approaching-border';
        return '';
    }

    function getPriorityClass(p) {
        return { alta: 'high', media: 'medium', baja: 'low' }[p] || '';
    }

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function renderTaskCard(task) {
        var dueClass = getDueDateClass(task.due_date);
        var borderClass = getCardBorderClass(task.due_date);
        var dueLabel = '';
        if (task.due_date) {
            var iconMap = { overdue: 'bi-exclamation-circle', 'due-soon': 'bi-alarm', 'due-approaching': 'bi-clock', 'due-today': 'bi-calendar-check' };
            var icon = iconMap[dueClass] || 'bi-calendar3';
            dueLabel = '<span class="task-due-date ' + dueClass + '"><i class="bi ' + icon + '"></i> ' + formatDateTime(task.due_date) + '</span>';
        }
        var reminderHtml = '';
        if (task.reminder_minutes !== null && task.reminder_minutes !== undefined && task.due_date) {
            var label = REMINDER_LABELS[String(task.reminder_minutes)];
            if (label) {
                reminderHtml = '<span class="reminder-badge"><i class="bi bi-bell"></i> ' + label + '</span>';
            }
        }
        var descHtml = task.description ? '<p class="task-description">' + escapeHtml(task.description) + '</p>' : '';
        var catIcon = CATEGORY_ICONS[task.category] || 'bi-three-dots';
        var completedClass = task.completed ? 'completed' : '';
        var checkedAttr = task.completed ? 'checked' : '';
        var createdDate = '';
        if (task.created_at) {
            var cd = new Date(task.created_at);
            if (!isNaN(cd.getTime())) {
                createdDate = cd.toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
            }
        }
        var catLabel = task.category ? task.category.charAt(0).toUpperCase() + task.category.slice(1) : '';

        return '<div class="task-card ' + completedClass + ' ' + borderClass + '" data-id="' + task.id + '">' +
            '<div class="task-check">' +
            '<input class="form-check-input task-toggle" type="checkbox" ' + checkedAttr + ' data-id="' + task.id + '">' +
            '</div>' +
            '<div class="task-content">' +
            '<div class="task-header">' +
            '<h5 class="task-title">' + escapeHtml(task.title) + '</h5>' +
            '<span class="task-priority-badge ' + getPriorityClass(task.priority) + '">' +
            '<span class="priority-dot ' + getPriorityClass(task.priority) + '"></span> ' +
            (PRIORITY_LABELS[task.priority] || task.priority) + '</span>' +
            '</div>' +
            descHtml +
            '<div class="task-meta">' +
            '<span class="task-category"><i class="bi ' + catIcon + '"></i> ' + catLabel + '</span>' +
            dueLabel +
            reminderHtml +
            (createdDate ? '<span class="task-created-at">' + createdDate + '</span>' : '') +
            '</div>' +
            '</div>' +
            '<div class="task-actions">' +
            '<button class="btn-task-action edit" data-id="' + task.id + '" title="Editar"><i class="bi bi-pencil"></i></button>' +
            '<button class="btn-task-action delete" data-id="' + task.id + '" title="Eliminar"><i class="bi bi-trash"></i></button>' +
            '</div>' +
            '</div>';
    }

    function renderTasks(tasks) {
        var container = $('#tasksList');
        var empty = $('#emptyState');
        var emptyMsg = $('#emptyStateMsg');

        if (!container) return;

        if (!tasks || tasks.length === 0) {
            container.innerHTML = '';
            if (empty) {
                empty.classList.remove('d-none');
                if (emptyMsg) {
                    if (currentFilters.search) {
                        emptyMsg.textContent = 'No se encontraron tareas con "' + currentFilters.search + '".';
                    } else if (currentFilters.status !== 'all' || currentFilters.priority !== 'all' || currentFilters.category !== 'all') {
                        emptyMsg.textContent = 'No hay tareas con los filtros seleccionados.';
                    } else {
                        emptyMsg.textContent = 'Crea tu primera tarea para empezar.';
                    }
                }
            }
            return;
        }

        if (empty) empty.classList.add('d-none');
        container.innerHTML = tasks.map(renderTaskCard).join('');
        updateStats();
    }

    function loadTasks() {
        showLoading();
        var params = new URLSearchParams();
        if (currentFilters.status !== 'all') params.set('status', currentFilters.status);
        if (currentFilters.priority !== 'all') params.set('priority', currentFilters.priority);
        if (currentFilters.category !== 'all') params.set('category', currentFilters.category);
        params.set('sort', currentFilters.sort);

        var url = currentFilters.search
            ? '/search?q=' + encodeURIComponent(currentFilters.search)
            : '/filter?' + params.toString();

        api(url).then(function (tasks) {
            hideLoading();
            renderTasks(tasks);
        }).catch(function () {
            hideLoading();
            showToast('Error al cargar tareas', 'error');
        });
    }

    function updateStats() {
        api('/stats').then(function (stats) {
            var el = $('#statTotal'); if (el) el.textContent = stats.total;
            el = $('#statPending'); if (el) el.textContent = stats.pending;
            el = $('#statCompleted'); if (el) el.textContent = stats.completed;
            var pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
            el = $('#statProgress'); if (el) el.textContent = pct + '%';
            el = $('#progressBar'); if (el) el.style.width = pct + '%';
        }).catch(function () {});
    }

    function openCreateModal() {
        var el;
        $('#modalTitle').textContent = 'Nueva Tarea';
        $('#saveTaskBtn').innerHTML = '<i class="bi bi-check-lg"></i> Guardar';
        var form = $('#taskForm');
        if (form) form.reset();
        el = $('#taskId'); if (el) el.value = '';
        el = $('#taskTitle'); if (el) el.value = '';
        el = $('#taskDescription'); if (el) el.value = '';
        el = $('#taskPriority'); if (el) el.value = 'media';
        el = $('#taskCategory'); if (el) el.value = 'personal';
        el = $('#taskDueDate'); if (el) el.value = '';
        el = $('#taskReminder'); if (el) el.value = '';
        $$('.form-control.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
        $$('.invalid-feedback').forEach(function (el) { el.textContent = ''; });
        var modalEl = $('#taskModal');
        if (modalEl) {
            var modal = new bootstrap.Modal(modalEl);
            modal.show();
            setTimeout(function () { var ti = $('#taskTitle'); if (ti) ti.focus(); }, 300);
        }
    }

    function openEditModal(taskId) {
        api('/tasks/' + taskId).then(function (task) {
            if (!task || task.id === undefined) {
                showToast('Error al cargar la tarea', 'error');
                return;
            }
            $('#modalTitle').textContent = 'Editar Tarea';
            $('#saveTaskBtn').innerHTML = '<i class="bi bi-check-lg"></i> Actualizar';
            var el;
            el = $('#taskId'); if (el) el.value = task.id;
            el = $('#taskTitle'); if (el) el.value = task.title;
            el = $('#taskDescription'); if (el) el.value = task.description || '';
            el = $('#taskPriority'); if (el) el.value = task.priority;
            el = $('#taskCategory'); if (el) el.value = task.category;
            el = $('#taskDueDate'); if (el) {
                if (task.due_date) {
                    var d = new Date(task.due_date);
                    if (!isNaN(d.getTime())) {
                        var yyyy = d.getFullYear();
                        var mm = String(d.getMonth() + 1).padStart(2, '0');
                        var dd = String(d.getDate()).padStart(2, '0');
                        var hh = String(d.getHours()).padStart(2, '0');
                        var min = String(d.getMinutes()).padStart(2, '0');
                        el.value = yyyy + '-' + mm + '-' + dd + 'T' + hh + ':' + min;
                    } else {
                        el.value = task.due_date;
                    }
                } else {
                    el.value = '';
                }
            }
            el = $('#taskReminder'); if (el) el.value = (task.reminder_minutes !== null && task.reminder_minutes !== undefined) ? String(task.reminder_minutes) : '';
            $$('.form-control.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
            $$('.invalid-feedback').forEach(function (el) { el.textContent = ''; });
            var modalEl = $('#taskModal');
            if (modalEl) {
                var modal = new bootstrap.Modal(modalEl);
                modal.show();
                setTimeout(function () { var ti = $('#taskTitle'); if (ti) ti.focus(); }, 300);
            }
        }).catch(function () {
            showToast('Error al cargar la tarea', 'error');
        });
    }

    function openDeleteModal(taskId, title) {
        deleteTaskId = taskId;
        var el = $('#deleteTaskTitle');
        if (el) el.textContent = '¿Eliminar "' + title + '"? Esta acción no se puede deshacer.';
        var modalEl = $('#deleteModal');
        if (modalEl) {
            var modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }

    function saveTask(data) {
        var taskId = $('#taskId') ? $('#taskId').value : '';
        var method = taskId ? 'PUT' : 'POST';
        var url = taskId ? '/tasks/' + taskId : '/tasks';

        var reminderVal = $('#taskReminder') ? $('#taskReminder').value : '';
        data.reminder_minutes = reminderVal !== '' ? parseInt(reminderVal) : null;

        api(url, { method: method, body: JSON.stringify(data) }).then(function (result) {
            if (result.success) {
                var modal = bootstrap.Modal.getInstance($('#taskModal'));
                if (modal) modal.hide();
                showToast(taskId ? 'Tarea actualizada' : 'Tarea creada', 'success');
                loadTasks();
            } else if (result.errors) {
                for (var key in result.errors) {
                    var input = $('#taskTitle');
                    var errorEl = $('#titleError');
                    if (key === 'due_date') errorEl = $('#dateError');
                    if (input) input.classList.add('is-invalid');
                    if (errorEl) errorEl.textContent = result.errors[key];
                }
            }
        }).catch(function (err) {
            if (err && typeof err.json === 'function') {
                err.json().then(function (result) {
                    if (result && result.errors) {
                        for (var key in result.errors) {
                            var input = $('#taskTitle');
                            var errorEl = $('#titleError');
                            if (key === 'due_date') errorEl = $('#dateError');
                            if (input) input.classList.add('is-invalid');
                            if (errorEl) errorEl.textContent = result.errors[key];
                        }
                    }
                }).catch(function () {
                    showToast('Error al guardar la tarea', 'error');
                });
            } else {
                showToast('Error al guardar la tarea', 'error');
            }
        });
    }

    function toggleTask(taskId) {
        var card = document.querySelector('.task-card[data-id="' + taskId + '"]');
        if (card) card.style.opacity = '0.5';
        api('/tasks/' + taskId + '/toggle', { method: 'PATCH' }).then(function (result) {
            if (result.success) {
                loadTasks();
                showToast(result.task.completed ? 'Tarea completada' : 'Tarea pendiente', result.task.completed ? 'success' : 'info');
            }
        }).catch(function () {
            if (card) card.style.opacity = '';
            showToast('Error al actualizar la tarea', 'error');
        });
    }

    function deleteTask(taskId) {
        api('/tasks/' + taskId, { method: 'DELETE' }).then(function (result) {
            if (result.success) {
                showToast('Tarea eliminada', 'success');
                loadTasks();
            }
        }).catch(function () {
            showToast('Error al eliminar la tarea', 'error');
        });
    }

    function updateFilterTags() {
        var container = $('#filterTags');
        var wrapper = $('#activeFilters');
        if (!container || !wrapper) return;
        var tags = [];
        if (currentFilters.status !== 'all') {
            var labels = { pending: 'Pendientes', completed: 'Completadas' };
            tags.push({ key: 'status', label: labels[currentFilters.status] || currentFilters.status });
        }
        if (currentFilters.priority !== 'all') {
            tags.push({ key: 'priority', label: 'Prioridad: ' + (PRIORITY_LABELS[currentFilters.priority] || currentFilters.priority) });
        }
        if (currentFilters.category !== 'all') {
            var cats = { trabajo: 'Trabajo', universidad: 'Universidad', personal: 'Personal', compras: 'Compras', salud: 'Salud', otras: 'Otras' };
            tags.push({ key: 'category', label: 'Categoría: ' + (cats[currentFilters.category] || currentFilters.category) });
        }
        if (tags.length === 0) {
            wrapper.classList.add('d-none');
            return;
        }
        wrapper.classList.remove('d-none');
        container.innerHTML = tags.map(function (t) {
            return '<span class="filter-tag">' + t.label + '<button class="remove-filter" data-key="' + t.key + '">&times;</button></span>';
        }).join('');
    }

    function resetFilters() {
        $$('.filter-btn.active').forEach(function (b) { b.classList.remove('active'); });
        $$('.filter-group .filter-btn[data-value="all"]').forEach(function (b) { b.classList.add('active'); });
        currentFilters.status = 'all';
        currentFilters.priority = 'all';
        currentFilters.category = 'all';
        var sortEl = $('#sortSelect');
        currentFilters.sort = sortEl ? sortEl.value : 'created_at';
        updateFilterTags();
        loadTasks();
    }

    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    function showBrowserNotification(title, body) {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            try {
                var n = new Notification(title, { body: body, icon: '/static/images/icon.png' });
                setTimeout(function () { n.close(); }, 8000);
            } catch (e) {
                showToast(title + ': ' + body, 'info');
            }
        }
    }

    function checkReminders() {
        api('/reminders').then(function (tasks) {
            if (!tasks || tasks.length === 0) return;
            tasks.forEach(function (task) {
                if (shownReminders.has(task.id)) return;
                shownReminders.add(task.id);
                var msg = 'Recordatorio: "' + task.title + '"';
                if (task.due_date) {
                    msg += ' vence ' + formatDateTime(task.due_date);
                }
                showToast(msg, 'warning');
                showBrowserNotification('ToDo App - Recordatorio', msg);
            });
        }).catch(function () {});
    }

    function startReminderChecker() {
        if (reminderInterval) clearInterval(reminderInterval);
        checkReminders();
        reminderInterval = setInterval(checkReminders, 30000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        requestNotificationPermission();
        loadTasks();
        updateStats();
        startReminderChecker();

        var addBtn = $('#addTaskBtn');
        if (addBtn) addBtn.addEventListener('click', openCreateModal);
        var emptyAdd = $('#emptyAddBtn');
        if (emptyAdd) emptyAdd.addEventListener('click', openCreateModal);

        var taskForm = $('#taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', function (e) {
                e.preventDefault();
                var data = {
                    title: $('#taskTitle') ? $('#taskTitle').value.trim() : '',
                    description: $('#taskDescription') ? $('#taskDescription').value.trim() : '',
                    priority: $('#taskPriority') ? $('#taskPriority').value : 'media',
                    category: $('#taskCategory') ? $('#taskCategory').value : 'personal',
                    due_date: $('#taskDueDate') ? $('#taskDueDate').value || '' : ''
                };
                saveTask(data);
            });
        }

        var tasksList = $('#tasksList');
        if (tasksList) {
            tasksList.addEventListener('click', function (e) {
                var target = e.target.closest('.task-toggle');
                if (target) { toggleTask(parseInt(target.getAttribute('data-id'))); return; }

                target = e.target.closest('.btn-task-action.edit');
                if (target) { openEditModal(parseInt(target.getAttribute('data-id'))); return; }

                target = e.target.closest('.btn-task-action.delete');
                if (target) {
                    var card = target.closest('.task-card');
                    var title = card ? card.querySelector('.task-title').textContent : '';
                    openDeleteModal(parseInt(target.getAttribute('data-id')), title);
                }
            });
        }

        var confirmDel = $('#confirmDeleteBtn');
        if (confirmDel) {
            confirmDel.addEventListener('click', function () {
                if (deleteTaskId) {
                    deleteTask(deleteTaskId);
                    deleteTaskId = null;
                    var modal = bootstrap.Modal.getInstance($('#deleteModal'));
                    if (modal) modal.hide();
                }
            });
        }

        var searchInput = $('#searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimeout);
                var val = this.value.trim();
                var clearBtn = $('#searchClear');
                if (clearBtn) {
                    if (val) clearBtn.classList.remove('d-none');
                    else clearBtn.classList.add('d-none');
                }
                searchTimeout = setTimeout(function () {
                    currentFilters.search = val;
                    loadTasks();
                }, 300);
            });
        }

        var searchClear = $('#searchClear');
        if (searchClear) {
            searchClear.addEventListener('click', function () {
                var si = $('#searchInput');
                if (si) si.value = '';
                searchClear.classList.add('d-none');
                currentFilters.search = '';
                loadTasks();
                if (si) si.focus();
            });
        }

        $$('.filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var filter = this.getAttribute('data-filter');
                var value = this.getAttribute('data-value');
                if (!filter || !value) return;
                var group = this.closest('.filter-group');
                if (group) {
                    group.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
                }
                this.classList.add('active');
                currentFilters[filter] = value;
                updateFilterTags();
                loadTasks();
            });
        });

        var filterTags = $('#filterTags');
        if (filterTags) {
            filterTags.addEventListener('click', function (e) {
                var btn = e.target.closest('.remove-filter');
                if (!btn) return;
                var key = btn.getAttribute('data-key');
                if (!key) return;
                currentFilters[key] = 'all';
                var groupEl = document.getElementById(key + 'Filters');
                if (groupEl) {
                    groupEl.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
                    var allBtn = groupEl.querySelector('.filter-btn[data-value="all"]');
                    if (allBtn) allBtn.classList.add('active');
                }
                updateFilterTags();
                loadTasks();
            });
        }

        var clearFilters = $('#clearFiltersBtn');
        if (clearFilters) clearFilters.addEventListener('click', resetFilters);

        var sortSelect = $('#sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', function () {
                currentFilters.sort = this.value;
                loadTasks();
            });
        }

        var savedTheme = localStorage.getItem('todo-theme') || 'light';
        document.documentElement.setAttribute('data-bs-theme', savedTheme);
        var themeToggle = $('#themeToggle');
        if (themeToggle) {
            if (savedTheme === 'dark') themeToggle.checked = true;
            themeToggle.addEventListener('change', function () {
                var theme = this.checked ? 'dark' : 'light';
                document.documentElement.setAttribute('data-bs-theme', theme);
                localStorage.setItem('todo-theme', theme);
            });
        }

        var menuToggle = $('#menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', function () {
                var sidebar = $('#sidebar');
                var overlay = $('#sidebarOverlay');
                if (sidebar) sidebar.classList.toggle('open');
                if (overlay) overlay.classList.toggle('active');
            });
        }

        var closeSidebar = $('#closeSidebar');
        if (closeSidebar) {
            closeSidebar.addEventListener('click', function () {
                var sidebar = $('#sidebar');
                var overlay = $('#sidebarOverlay');
                if (sidebar) sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            });
        }

        var sidebarOverlay = $('#sidebarOverlay');
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function () {
                var sidebar = $('#sidebar');
                var overlay = $('#sidebarOverlay');
                if (sidebar) sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                var si = $('#searchInput');
                if (si) si.focus();
            }
            if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
                var active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) return;
                e.preventDefault();
                openCreateModal();
            }
            if (e.key === 'Escape') {
                var toastContainer = $('.toast-container');
                if (toastContainer && toastContainer.lastElementChild) {
                    removeToast(toastContainer.lastElementChild);
                }
            }
        });
    });

})();
