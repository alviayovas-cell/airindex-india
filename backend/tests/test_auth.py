def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["status"] == "ok"


def test_login_success(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "analyst@airindex.dev", "password": "airindex123"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["success"] is True
    assert body["data"]["token_type"] == "bearer"
    assert body["data"]["user"]["email"] == "analyst@airindex.dev"


def test_login_wrong_password(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "analyst@airindex.dev", "password": "nope"},
    )
    assert r.status_code == 401
    body = r.json()
    assert body["success"] is False
    assert body["data"] is None


def test_login_validation_error(client):
    r = client.post("/api/auth/login", json={"email": "not-an-email"})
    assert r.status_code == 422
    assert r.json()["success"] is False


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_with_token(auth_client):
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["data"]["email"] == "analyst@airindex.dev"
