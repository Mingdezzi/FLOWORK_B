import click
from flask.cli import with_appcontext
from .extensions import db
from .models import User, Store, Brand

@click.command('init-db')
@with_appcontext
def init_db_command():
    try:
        db.drop_all()
        db.create_all()
        click.echo('Initialized the database.')
    except Exception as e:
        click.echo(f'Error initializing database: {e}')

@click.command('create-super-admin')
@with_appcontext
def create_super_admin():
    username = 'superadmin'
    password = 'password'
    
    if User.query.filter_by(username=username).first():
        click.echo('Super admin already exists.')
        return

    user = User(username=username, role='super_admin', is_active=True)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    click.echo(f'Created super admin: {username}')