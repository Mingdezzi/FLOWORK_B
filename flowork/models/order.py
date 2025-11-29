from . import db

class Order(db.Model):
    __tablename__ = 'orders'

    id = db.Column(db.Integer, primary_key=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=False)
    
    customer_name = db.Column(db.String(50), nullable=False)
    customer_phone = db.Column(db.String(20), nullable=False)
    
    postcode = db.Column(db.String(10), nullable=True)
    address1 = db.Column(db.String(200), nullable=True)
    address2 = db.Column(db.String(200), nullable=True)
    reception_method = db.Column(db.String(20), default='방문수령')
    
    product_number = db.Column(db.String(50), nullable=False)
    product_name = db.Column(db.String(200), nullable=True)
    color = db.Column(db.String(50), nullable=False)
    size = db.Column(db.String(20), nullable=False)
    
    order_status = db.Column(db.String(20), default='고객주문')
    
    courier = db.Column(db.String(50), nullable=True)
    tracking_number = db.Column(db.String(50), nullable=True)
    
    remarks = db.Column(db.Text, nullable=True)
    
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    updated_at = db.Column(db.DateTime, onupdate=db.func.now())
    completed_at = db.Column(db.DateTime, nullable=True)
    
    store = db.relationship('Store', backref='customer_orders')
    
    @property
    def sms_link(self):
        return f"sms:{self.customer_phone}"

class ProcessingStep(db.Model):
    __tablename__ = 'processing_steps'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    source_store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True)
    
    source_result = db.Column(db.String(20), nullable=True)
    
    created_at = db.Column(db.DateTime, server_default=db.func.now())
    
    order = db.relationship('Order', backref=db.backref('processing_steps', lazy='dynamic', cascade='all, delete-orphan'))