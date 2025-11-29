from . import db

class Brand(db.Model):
    __tablename__ = 'brands'
    id = db.Column(db.Integer, primary_key=True)
    brand_name = db.Column(db.String(50), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'brand_name': self.brand_name
        }

class Store(db.Model):
    __tablename__ = 'stores'
    
    id = db.Column(db.Integer, primary_key=True)
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=False)
    
    store_name = db.Column(db.String(100), nullable=False)
    store_code = db.Column(db.String(50), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    manager_name = db.Column(db.String(50), nullable=True)
    
    is_registered = db.Column(db.Boolean, default=False)
    is_approved = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, server_default=db.func.now())

    brand = db.relationship('Brand', backref='stores')

    def to_dict(self):
        return {
            'id': self.id,
            'brand_id': self.brand_id,
            'store_name': self.store_name,
            'store_code': self.store_code,
            'is_active': self.is_active
        }

class Staff(db.Model):
    __tablename__ = 'staff'
    
    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    
    name = db.Column(db.String(50), nullable=False)
    position = db.Column(db.String(50), nullable=True)
    contact = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    store = db.relationship('Store', backref='staff_members')

class Setting(db.Model):
    __tablename__ = 'settings'
    id = db.Column(db.Integer, primary_key=True)
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=False)
    key = db.Column(db.String(50), nullable=False)
    value = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now())

    __table_args__ = (db.UniqueConstraint('brand_id', 'key', name='_brand_key_uc'),)