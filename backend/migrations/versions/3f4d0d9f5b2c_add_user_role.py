"""add role to users

Revision ID: 3f4d0d9f5b2c
Revises: 19b1c9433c36
Create Date: 2025-02-15 19:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3f4d0d9f5b2c'
down_revision = '19b1c9433c36'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'Users',
        sa.Column('role', sa.String(length=32), nullable=False, server_default='user')
    )


def downgrade():
    op.drop_column('Users', 'role')
