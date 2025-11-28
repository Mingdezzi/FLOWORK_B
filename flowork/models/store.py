from ..extensions import db
from datetime import datetime
from sqlalchemy import UniqueConstraint

class Store(db.Model):
    __tablename__ = 'stores'
    id = db.Column(db.Integer, primary_key=True)
    store_name = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(50), nullable=True)
    
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=False, index=True)
    brand = db.relationship('Brand', back_populates='stores')
    
    users = db.relationship('User', back_populates='store', lazy='dynamic', foreign_keys='User.store_id')
    store_code = db.Column(db.String(100), nullable=True, index=True) 
    manager_name = db.Column(db.String(100), nullable=True) 
    is_registered = db.Column(db.Boolean, default=False, nullable=False, index=True)
    is_approved = db.Column(db.Boolean, default=False, nullable=False, index=True)  
    is_active = db.Column(db.Boolean, default=True, nullable=False, index=True)     
    
    orders = db.relationship('Order', backref='store', lazy='dynamic')
    stock_levels = db.relationship('StoreStock', backref='store', lazy='dynamic', foreign_keys='StoreStock.store_id')
    staff_members = db.relationship('Staff', backref='store', lazy='dynamic', cascade="all, delete-orphan")
    received_processings = db.relationship('OrderProcessing', backref='source_store', lazy='dynamic', foreign_keys='OrderProcessing.source_store_id')
    sales = db.relationship('Sale', back_populates='store', lazy='dynamic')
    
    __table_args__ = (UniqueConstraint('brand_id', 'store_code', name='uq_brand_id_store_code'),)

class Staff(db.Model):
    __tablename__ = 'staff'
    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False) 
    position = db.Column(db.String(100), nullable=True) 
    contact = db.Column(db.String(50), nullable=True) 
    is_active = db.Column(db.Boolean, default=True) 
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.now)

class Setting(db.Model):
    __tablename__ = 'settings'
    id = db.Column(db.Integer, primary_key=True)
    brand_id = db.Column(db.Integer, db.ForeignKey('brands.id'), nullable=False, index=True)
    brand = db.relationship('Brand', back_populates='settings')
    key = db.Column(db.String(100), nullable=False, index=True)
    value = db.Column(db.Text, nullable=True)
    __table_args__ = (UniqueConstraint('brand_id', 'key', name='uq_brand_id_key'),)