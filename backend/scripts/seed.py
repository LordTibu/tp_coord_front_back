#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import random

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from apps import create_app, db
from apps.config import config_dict
from apps.authentication.models import Users
from apps.base.models import Company, Product


def get_config():
    debug = os.getenv('DEBUG', 'False') == 'True'
    config_name = 'Debug' if debug else 'Production'
    return config_dict[config_name]


def get_or_create_company(name: str) -> Company:
    company = Company.query.filter_by(name=name).first()
    if company:
        return company
    company = Company(name=name)
    db.session.add(company)
    db.session.flush()
    return company


def ensure_user(*, username: str, email: str, password: str, role: str, company: Company) -> Users:
    user = Users.query.filter_by(username=username).first()
    if user:
        changed = False
        if role and user.role != role:
            user.role = role
            changed = True
        if email and user.email != email:
            user.email = email
            changed = True
        if company and user.company_id != company.id:
            user.company_id = company.id
            changed = True
        if changed:
            db.session.add(user)
        return user

    user = Users(
        username=username,
        email=email,
        password=password,
        role=role,
        company_id=company.id if company else None,
    )
    db.session.add(user)
    return user


def ensure_product(*, name: str, company: Company, comment: str, quantity: int) -> Product:
    product = Product.query.filter_by(name=name, company_id=company.id).first()
    if product:
        return product
    product = Product(
        name=name,
        comment=comment,
        quantity=quantity,
        company_id=company.id,
    )
    db.session.add(product)
    return product


def seed():
    admin_company_name = os.getenv('SEED_ADMIN_COMPANY', 'Admin Company')
    user_company_name = os.getenv('SEED_USER_COMPANY', 'User Company')

    admin_username = os.getenv('SEED_ADMIN_USERNAME', 'admin')
    admin_email = os.getenv('SEED_ADMIN_EMAIL', 'admin@example.com')
    admin_password = os.getenv('SEED_ADMIN_PASSWORD', 'admin123')

    user_username = os.getenv('SEED_USER_USERNAME', 'user')
    user_email = os.getenv('SEED_USER_EMAIL', 'user@example.com')
    user_password = os.getenv('SEED_USER_PASSWORD', 'user123')

    admin_company = get_or_create_company(admin_company_name)
    user_company = get_or_create_company(user_company_name)

    ensure_user(
        username=admin_username,
        email=admin_email,
        password=admin_password,
        role='admin',
        company=admin_company,
    )

    ensure_user(
        username=user_username,
        email=user_email,
        password=user_password,
        role='user',
        company=user_company,
    )

    product_names = ['bananos', 'cocos', 'aguacates', 'platanos', 'huevos']
    seed_value = os.getenv('SEED_RANDOM', 'tp_coord_front_back')
    rng = random.Random(seed_value)
    companies = [admin_company, user_company]

    for name in product_names:
        company = rng.choice(companies)
        quantity = rng.randint(1, 20)
        ensure_product(
            name=name,
            company=company,
            comment=f"seeded {name}",
            quantity=quantity,
        )

    db.session.commit()


def main():
    app = create_app(get_config())
    with app.app_context():
        seed()


if __name__ == '__main__':
    main()
