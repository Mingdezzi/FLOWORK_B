from . import db

class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=False)
    
    product_number = db.Column(db.String(50), nullable=False)
    product_name = db.Column(db.String(200), nullable=False)
    
    # 검색 최적화를 위한 정제된 컬럼
    product_number_cleaned = db.Column(db.String(50), index=True)
    product_name_cleaned = db.Column(db.String(200), index=True)
    
    release_year = db.Column(db.Integer, nullable=True)
    item_category = db.Column(db.String(50), nullable=True)
    sub_category = db.Column(db.String(50), nullable=True)
    gender = db.Column(db.String(20), nullable=True)
    
    is_favorite = db.Column(db.Integer, default=0)
    
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, onupdate=db.func.now())

    # 상품 삭제 시 하위 옵션도 자동 삭제
    variants = db.relationship('Variant', backref='product', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('brand_id', 'product_number', name='_brand_pn_uc'),
    )

class Variant(db.Model):
    __tablename__ = 'variants'

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    
    color = db.Column(db.String(50), nullable=False)
    size = db.Column(db.String(20), nullable=False)
    barcode = db.Column(db.String(50), unique=True, nullable=True)
    
    original_price = db.Column(db.Integer, default=0)
    sale_price = db.Column(db.Integer, default=0)
    cost_price = db.Column(db.Integer, default=0)
    
    hq_quantity = db.Column(db.Integer, default=0) 
    
    # 옵션 삭제 시 매장 재고 데이터도 삭제
    store_stocks = db.relationship('StoreStock', backref='variant', cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('product_id', 'color', 'size', name='_prod_color_size_uc'),
    )

class StoreStock(db.Model):
    __tablename__ = 'store_stocks'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('variants.id'), nullable=False)
    
    quantity = db.Column(db.Integer, default=0)
    location = db.Column(db.String(50), nullable=True)
    
    # 재고 실사 관련 필드
    actual_stock = db.Column(db.Integer, nullable=True)
    stock_diff = db.Column(db.Integer, nullable=True)
    last_check_date = db.Column(db.DateTime, nullable=True)

    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    store = db.relationship('Store', backref='stocks')
    # variant는 위에서 backref로 정의됨

    __table_args__ = (
        db.UniqueConstraint('store_id', 'variant_id', name='_store_variant_uc'),
    )

class StockHistory(db.Model):
    __tablename__ = 'stock_history'
    
    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True)
    variant_id = db.Column(db.Integer, db.ForeignKey('variants.id'), nullable=False)
    
    change_type = db.Column(db.String(20), nullable=False) # SALE, REFUND, IN, OUT, CHECK
    quantity_change = db.Column(db.Integer, nullable=False)
    final_quantity = db.Column(db.Integer, nullable=False)
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    description = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, server_default=db.func.now())