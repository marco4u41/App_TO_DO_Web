from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

REMINDER_CHOICES = [
    (None, 'Sin recordatorio'),
    (0, 'En el momento exacto'),
    (5, '5 minutos antes'),
    (15, '15 minutos antes'),
    (30, '30 minutos antes'),
    (60, '1 hora antes'),
    (1440, '1 día antes'),
]
VALID_REMINDER_MINUTES = {opt[0] for opt in REMINDER_CHOICES}


class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, default='')
    priority = db.Column(db.String(10), default='media')
    category = db.Column(db.String(50), default='personal')
    due_date = db.Column(db.DateTime, nullable=True)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    reminder_minutes = db.Column(db.Integer, nullable=True)

    PRIORITIES = ['alta', 'media', 'baja']
    CATEGORIES = ['trabajo', 'universidad', 'personal', 'compras', 'salud', 'otras']

    def _serialize_dt(self, dt):
        if dt is None:
            return None
        try:
            return dt.isoformat()
        except (AttributeError, ValueError):
            return str(dt)

    def to_dict(self, include_dates=True):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'priority': self.priority,
            'category': self.category,
            'completed': self.completed,
            'reminder_minutes': self.reminder_minutes,
        }
        if include_dates:
            data['due_date'] = self._serialize_dt(self.due_date)
            data['created_at'] = self._serialize_dt(self.created_at)
        return data

    def __repr__(self):
        return f'<Task {self.id}: {self.title}>'
