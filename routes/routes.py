from datetime import datetime, timedelta
from flask import Blueprint, jsonify, render_template, request
from models.task import db, Task
from utils.validators import validate_task_data

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    tasks = Task.query.order_by(Task.created_at.desc()).all()
    return render_template('index.html', tasks=tasks)


@main_bp.route('/api/tasks', methods=['GET'])
def get_tasks():
    tasks = Task.query.order_by(Task.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks])


@main_bp.route('/api/tasks', methods=['POST'])
def create_task():
    data = request.get_json()
    result = validate_task_data(data)

    if result['errors']:
        return jsonify({'success': False, 'errors': result['errors']}), 400

    existing = Task.query.filter(
        db.func.lower(Task.title) == result['title'].lower(),
        Task.completed == False
    ).first()
    if existing:
        return jsonify({
            'success': False,
            'errors': {'title': 'Ya existe una tarea pendiente con ese título.'}
        }), 400

    task = Task(
        title=result['title'],
        description=result['description'],
        priority=result['priority'],
        category=result['category'],
        due_date=result['due_date'],
        reminder_minutes=result.get('reminder_minutes'),
    )
    db.session.add(task)
    db.session.commit()

    return jsonify({'success': True, 'task': task.to_dict()}), 201


@main_bp.route('/api/tasks/<int:task_id>', methods=['GET'])
def get_task(task_id):
    task = Task.query.get_or_404(task_id)
    return jsonify(task.to_dict())


@main_bp.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    task = Task.query.get_or_404(task_id)
    data = request.get_json()
    result = validate_task_data(data)

    if result['errors']:
        return jsonify({'success': False, 'errors': result['errors']}), 400

    duplicate = Task.query.filter(
        db.func.lower(Task.title) == result['title'].lower(),
        Task.id != task_id,
        Task.completed == False
    ).first()
    if duplicate:
        return jsonify({
            'success': False,
            'errors': {'title': 'Ya existe otra tarea pendiente con ese título.'}
        }), 400

    task.title = result['title']
    task.description = result['description']
    task.priority = result['priority']
    task.category = result['category']
    task.due_date = result['due_date']
    task.reminder_minutes = result.get('reminder_minutes')
    db.session.commit()

    return jsonify({'success': True, 'task': task.to_dict()})


@main_bp.route('/api/tasks/<int:task_id>/toggle', methods=['PATCH'])
def toggle_task(task_id):
    task = Task.query.get_or_404(task_id)
    task.completed = not task.completed
    db.session.commit()
    return jsonify({'success': True, 'task': task.to_dict()})


@main_bp.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.get_or_404(task_id)
    db.session.delete(task)
    db.session.commit()
    return jsonify({'success': True})


@main_bp.route('/api/reminders', methods=['GET'])
def check_reminders():
    now = datetime.now()
    tasks = Task.query.filter_by(completed=False).filter(
        Task.due_date.isnot(None),
        Task.reminder_minutes.isnot(None),
    ).all()

    due_now = []
    for t in tasks:
        reminder_time = t.due_date - timedelta(minutes=t.reminder_minutes)
        diff = (now - reminder_time).total_seconds()
        if 0 <= diff < 60:
            due_now.append(t.to_dict())

    return jsonify(due_now)


@main_bp.route('/api/stats', methods=['GET'])
def get_stats():
    total = Task.query.count()
    completed = Task.query.filter_by(completed=True).count()
    pending = total - completed
    overdue = 0
    due_today = 0
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)

    if pending > 0:
        all_pending = Task.query.filter_by(completed=False).all()
        for t in all_pending:
            if t.due_date:
                if t.due_date < now:
                    overdue += 1
                if today_start <= t.due_date < tomorrow_start:
                    due_today += 1

    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending,
        'overdue': overdue,
        'due_today': due_today,
    })


@main_bp.route('/api/search', methods=['GET'])
def search_tasks():
    q = request.args.get('q', '').strip()
    if not q:
        tasks = Task.query.order_by(Task.created_at.desc()).all()
    else:
        tasks = Task.query.filter(
            db.or_(
                Task.title.ilike(f'%{q}%'),
                Task.description.ilike(f'%{q}%'),
            )
        ).order_by(Task.created_at.desc()).all()

    return jsonify([t.to_dict() for t in tasks])


@main_bp.route('/api/filter', methods=['GET'])
def filter_tasks():
    status = request.args.get('status', '')
    priority = request.args.get('priority', '')
    category = request.args.get('category', '')
    sort_by = request.args.get('sort', 'created_at')

    query = Task.query

    if status == 'pending':
        query = query.filter_by(completed=False)
    elif status == 'completed':
        query = query.filter_by(completed=True)

    if priority:
        query = query.filter_by(priority=priority)

    if category:
        query = query.filter_by(category=category)

    sort_map = {
        'created_at': Task.created_at.desc(),
        'priority': Task.priority,
        'due_date': Task.due_date.asc().nulls_last(),
        'alphabetical': Task.title.asc(),
    }

    order = sort_map.get(sort_by, Task.created_at.desc())
    query = query.order_by(order)

    tasks = query.all()
    return jsonify([t.to_dict() for t in tasks])
