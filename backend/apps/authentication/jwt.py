# -*- encoding: utf-8 -*-

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional

import jwt
from flask import current_app, jsonify, request, g


def _jwt_secret() -> str:
    secret = current_app.config.get('JWT_SECRET_KEY') or current_app.config.get('SECRET_KEY')
    if not secret:
        raise RuntimeError('JWT secret key is not configured.')
    return secret


def _jwt_algorithm() -> str:
    return current_app.config.get('JWT_ALGORITHM', 'HS256')


def _jwt_expires_in() -> int:
    return int(current_app.config.get('JWT_EXPIRES_IN', 3600))


def create_access_token(user) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        'sub': user.id,
        'username': user.username,
        'email': user.email,
        'iat': int(now.timestamp()),
        'exp': int((now + timedelta(seconds=_jwt_expires_in())).timestamp()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=_jwt_algorithm())


def _token_from_header() -> Optional[str]:
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    return auth_header.split(' ', 1)[1].strip()


def get_current_user_from_token():
    token = _token_from_header()
    if not token:
        return None
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[_jwt_algorithm()])
    except jwt.PyJWTError:
        return None
    from apps.authentication.models import Users
    return Users.query.get(payload.get('sub'))


def token_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = _token_from_header()
        if not token:
            return jsonify({'message': 'Missing bearer token'}), 401
        try:
            payload = jwt.decode(token, _jwt_secret(), algorithms=[_jwt_algorithm()])
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expired'}), 401
        except jwt.PyJWTError:
            return jsonify({'message': 'Invalid token'}), 401

        from apps.authentication.models import Users
        user = Users.query.get(payload.get('sub'))
        if not user:
            return jsonify({'message': 'User not found'}), 401

        g.current_user = user
        return fn(*args, **kwargs)
    return wrapper
