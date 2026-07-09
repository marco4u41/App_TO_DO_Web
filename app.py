import os
from flask import Flask
from config import Config
from models.task import db
from routes.routes import main_bp


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db_dir = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'database')
    os.makedirs(db_dir, exist_ok=True)

    db.init_app(app)
    app.register_blueprint(main_bp)

    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
