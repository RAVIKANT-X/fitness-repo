"""create workout_sessions table

Revision ID: 001_workout_sessions
Revises: 
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001_workout_sessions'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'workout_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('exercise_id', sa.String(length=64), nullable=False),
        sa.Column('exercise_name', sa.String(length=128), nullable=False),
        sa.Column('reps', sa.Integer(), nullable=False),
        sa.Column('form_status', sa.String(length=16), nullable=False),
        sa.Column('deviations', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_workout_sessions_exercise_id'),
        'workout_sessions',
        ['exercise_id'],
        unique=False,
    )
    op.create_index(
        op.f('ix_workout_sessions_id'),
        'workout_sessions',
        ['id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_workout_sessions_id'), table_name='workout_sessions')
    op.drop_index(op.f('ix_workout_sessions_exercise_id'), table_name='workout_sessions')
    op.drop_table('workout_sessions')
