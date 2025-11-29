from flask import Flask
from .config import Config
from .extensions import db, migrate, login_manager
from .blueprints.auth import auth_bp
from .blueprints.ui import ui_bp
from .blueprints.api import api_bp
from .commands import init_db_command, create_super_admin

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    app.register_blueprint(auth_bp)
    app.register_blueprint(ui_bp)
    app.register_blueprint(api_bp)

    app.cli.add_command(init_db_command)
    app.cli.add_command(create_super_admin)

    from .models import User, Store, Brand

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    return app