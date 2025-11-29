from . import db

class StoreOrder(db.Model):
    __tablename__ = 'store_orders'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    variant_id = db.Column(db.Integer, db.ForeignKey('variants.id'), nullable=False)
    
    # ORDER(주문), RETURN(반품)
    order_type = db.Column(db.String(20), default='ORDER')
    
    quantity = db.Column(db.Integer, nullable=False)
    confirmed_quantity = db.Column(db.Integer, nullable=True)
    
    # REQUESTED, APPROVED, REJECTED, COMPLETED
    status = db.Column(db.String(20), default='REQUESTED')
    
    order_date = db.Column(db.Date, nullable=False)
    return_date = db.Column(db.Date, nullable=True)
    
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, onupdate=db.func.now())
    
    store = db.relationship('Store', backref='store_orders')
    variant = db.relationship('Variant')