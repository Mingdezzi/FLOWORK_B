from . import db

class Sale(db.Model):
    __tablename__ = 'sales'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    receipt_number = db.Column(db.String(50), unique=True, nullable=False)
    sale_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    total_amount = db.Column(db.Integer, default=0)
    payment_method = db.Column(db.String(20), default='card')
    status = db.Column(db.String(20), default='valid') # valid, refunded
    is_online = db.Column(db.Boolean, default=False)
    
    store = db.relationship('Store', backref='sales')
    user = db.relationship('User')
    
    # 영수증 삭제 시 상세 아이템도 자동 삭제
    items = db.relationship('SaleItem', backref='sale', cascade='all, delete-orphan')

class SaleItem(db.Model):
    __tablename__ = 'sale_items'

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('variants.id'), nullable=False)
    
    # 스냅샷 데이터 (가격 변동 대응)
    product_name = db.Column(db.String(200))
    product_number = db.Column(db.String(50))
    color = db.Column(db.String(50))
    size = db.Column(db.String(20))
    
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Integer, nullable=False)
    discount_amount = db.Column(db.Integer, default=0)
    subtotal = db.Column(db.Integer, nullable=False)
    
    variant = db.relationship('Variant')