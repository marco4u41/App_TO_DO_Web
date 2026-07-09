from datetime import datetime

VALID_REMINDER_MINUTES = {None, 0, 5, 15, 30, 60, 1440}


def validate_task_data(data):
    errors = {}

    title = data.get('title', '').strip()
    if not title:
        errors['title'] = 'El título es obligatorio.'
    elif len(title) > 200:
        errors['title'] = 'El título no puede exceder 200 caracteres.'

    priority = data.get('priority', 'media')
    if priority not in ('alta', 'media', 'baja'):
        errors['priority'] = 'Prioridad inválida.'

    category = data.get('category', 'personal')
    valid_categories = ['trabajo', 'universidad', 'personal', 'compras', 'salud', 'otras']
    if category not in valid_categories:
        errors['category'] = 'Categoría inválida.'

    due_date_str = data.get('due_date', '').strip()
    due_date = None
    if due_date_str:
        for fmt in ('%Y-%m-%dT%H:%M', '%Y-%m-%d'):
            try:
                due_date = datetime.strptime(due_date_str, fmt)
                break
            except ValueError:
                continue
        if due_date is None:
            errors['due_date'] = 'Formato de fecha inválido (use AAAA-MM-DD o AAAA-MM-DDTHH:MM).'

    reminder_minutes = data.get('reminder_minutes')
    if reminder_minutes is not None:
        try:
            reminder_minutes = int(reminder_minutes)
        except (TypeError, ValueError):
            errors['reminder_minutes'] = 'Valor de recordatorio inválido.'
            reminder_minutes = None

    description = data.get('description', '').strip()

    return {
        'title': title,
        'description': description,
        'priority': priority,
        'category': category,
        'due_date': due_date,
        'reminder_minutes': reminder_minutes,
        'errors': errors,
    }
