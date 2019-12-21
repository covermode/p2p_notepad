#!/usr/bin/env python3.7
################################################################################
# Первая версия сервера.
# Для ознакомления с взаимодействием браузера, JavaScript в браузере,
# WebSocket-ов, сервера на Python.
################################################################################

import logging
import quart

app = quart.Quart(__name__, template_folder="templates", static_folder="static")

log = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG, format="> %(asctime)-15s %(levelname)-8s || %(message)s")

@app.route("/")
async def index():
    return await quart.render_template("index.html")

@app.route("/p/<page>")
async def handle_p(page):
    return await quart.render_template(f"p_{page}.html")

@app.websocket("/ws")
async def handle_ws():
    # Функция вызывается при установлении WebSocket-соединения между браузером и сервером.
    # Каждый раз, когда вы открываете новое окно браузера, происходит новый вызов данной функции.
    # Функция выполяется до тех пор, пока живо соединение между браузером и сервером.
    while True:
        data = await quart.websocket.receive()
        log.info("Получили от браузера %r", data)
        await quart.websocket.send(
            f"Подтверждаем, что получили '{data}'! Текст сгенерирован на сервере.")


def main():
    app.config.from_mapping(DEBUG=True, ENV="development")
    app.run()


if __name__ == "__main__":
    main()
