from . import db

class Sale(db.Model):
    __tablename__ = 'sales'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # [수정] 영수증 번호 생성 규칙에 필수적인 컬럼이므로 유지
    receipt_number = db.Column(db.String(50), unique=True, nullable=False)
    
    # [신규] 서비스 로직에서 사용하는 일일 순번 컬럼 추가 (누락되었던 부분)
    daily_number = db.Column(db.Integer, nullable=False, default=1)
    
    sale_date = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    total_amount = db.Column(db.Integer, default=0)
    payment_method = db.Column(db.String(20), default='card')
    status = db.Column(db.String(20), default='valid')
    is_online = db.Column(db.Boolean, default=False)
    
    store = db.relationship('Store', backref='sales')
    user = db.relationship('User')
    
    items = db.relationship('SaleItem', backref='sale', cascade='all, delete-orphan')

class SaleItem(db.Model):
    __tablename__ = 'sale_items'

    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('variants.id'), nullable=False)
    
    product_name = db.Column(db.String(200))
    product_number = db.Column(db.String(50))
    color = db.Column(db.String(50))
    size = db.Column(db.String(20))
    
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Integer, nullable=False)
    discount_amount = db.Column(db.Integer, default=0)
    discounted_price = db.Column(db.Integer, default=0)
    subtotal = db.Column(db.Integer, nullable=False)
    
    variant = db.relationship('Variant')