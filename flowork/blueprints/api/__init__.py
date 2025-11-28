from flask import Blueprint

api_bp = Blueprint('api', __name__)

from . import inventory, sales, order, admin, tasks, maintenance, stock_transfer, store_order