import click
from flask.cli import with_appcontext
from .extensions import db
from .models import (
    Brand, Store, User, Product, Variant, StoreStock, StockHistory,
    Order, OrderProcessing, Sale, SaleItem,
    Staff, Setting,
    StockTransfer,
    StoreOrder, StoreReturn
)

@click.command("init-db")
@with_appcontext
def init_db_command():
    """기존 데이터를 삭제하고 새 테이블을 생성합니다."""
    print("Dropping all tables...")
    db.drop_all() 
    print("Creating all tables...")
    db.create_all() 
    print("✅ 모든 DB 테이블 초기화 완료. (모든 데이터 삭제됨)")

@click.command("update-db")
@with_appcontext
def update_db_command():
    """삭제 없이 누락된 새 테이블만 생성합니다."""
    print("Checking and creating missing tables...")
    db.create_all()
    print("✅ DB 업데이트 완료. (누락된 테이블 생성됨)")