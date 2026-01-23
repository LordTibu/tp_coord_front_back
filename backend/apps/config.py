# -*- encoding: utf-8 -*-
import os
import locale

try:
    locale.setlocale(locale.LC_ALL, 'fr_FR.utf8')
except locale.Error:
    # Fallback for CI runners or systems without the French locale installed.
    locale.setlocale(locale.LC_ALL, 'C')


class Config(object):
    basedir = os.path.abspath(os.path.dirname(__file__))

    SECRET_KEY = os.getenv('SECRET_KEY', None)
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', None)
    JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
    JWT_EXPIRES_IN = int(os.getenv('JWT_EXPIRES_IN', '3600'))

    # CDN Support Settings 
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    LANGUAGES = ['fr-FR']

    # DB conf
    DB_ENGINE = os.getenv('DB_ENGINE', None)
    DB_USERNAME = os.getenv('DB_USERNAME', None)
    DB_PASS = os.getenv('DB_PASS', None)
    DB_HOST = os.getenv('DB_HOST', None)
    DB_PORT = os.getenv('DB_PORT', None)
    DB_NAME = os.getenv('DB_NAME', None)


    # try to set up a Relational DBMS
    if DB_ENGINE and DB_NAME and DB_USERNAME:

        try:

            # Relational DBMS: PSQL
            SQLALCHEMY_DATABASE_URI = '{}://{}:{}@{}:{}/{}'.format(
                DB_ENGINE,
                DB_USERNAME,
                DB_PASS,
                DB_HOST,
                DB_PORT,
                DB_NAME
            )

        except Exception as e:

            print('> Error: DBMS Exception: ' + str(e))
            print('> Fallback to SQLite ')


class ProductionConfig(Config):
    DEBUG = False

    SESSION_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_HTTPONLY = True
    REMEMBER_COOKIE_DURATION = 3600


class DebugConfig(Config):
    DEBUG = True


class TestingConfig(Config):
    TESTING = True
    SECRET_KEY = 'test-secret'
    JWT_SECRET_KEY = 'test-secret'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


# Load all possible configurations
config_dict = {
    'Production': ProductionConfig,
    'Debug': DebugConfig,
    'Testing': TestingConfig
}
