from apps import db
from apps.authentication.jwt import create_access_token
from apps.authentication.models import Users
from apps.base.models import Company


def _auth_context(app):
    with app.app_context():
        company = Company(name='TestCo')
        db.session.add(company)
        db.session.commit()

        user = Users(
            username='admin',
            email='admin@example.com',
            password='admin123',
            role='admin',
            company_id=company.id,
        )
        db.session.add(user)
        db.session.commit()

        token = create_access_token(user)
        return {'Authorization': f'Bearer {token}'}, company.id


def test_product_post_requires_auth(client):
    res = client.post(
        '/api/product/',
        json={'name': 'bananos', 'comment': 'test', 'quantity': 2, 'company_id': 1},
    )
    assert res.status_code == 401


def test_product_crud_with_auth(client, app):
    headers, company_id = _auth_context(app)
    payload = {'name': 'bananos', 'comment': 'test', 'quantity': 2, 'company_id': company_id}

    res_create = client.post('/api/product/', json=payload, headers=headers)
    assert res_create.status_code == 200
    created = res_create.get_json()
    assert created['name'] == payload['name']
    product_id = created['id']

    res_list = client.get('/api/product/')
    assert res_list.status_code == 200
    data = res_list.get_json().get('data', [])
    assert any(item['id'] == product_id for item in data)

    res_update = client.put(
        f'/api/product/{product_id}',
        json={'name': 'cocos'},
        headers=headers,
    )
    assert res_update.status_code == 200
    assert res_update.get_json()['name'] == 'cocos'

    res_delete = client.delete(f'/api/product/{product_id}', headers=headers)
    assert res_delete.status_code == 200
