up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

restart: down up

clean:
	docker compose down -v --remove-orphans

build:
	docker compose build
