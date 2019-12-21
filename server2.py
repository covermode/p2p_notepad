#!/usr/bin/env python3.7
################################################################################
# Вторая версия сервера.
# Исследуем возможность серверу независимо получать и отправлять сообщения.
################################################################################

import asyncio
import datetime
import logging
import random
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
    # В первой версии сервера код функции был устроен следующим образом:
    #     ```
    #     while True:
    #         data = await quart.websocket.receive()
    #         await quart.websocket.send(data)
    #     ```
    # При такой организации кода функция выполяется по следующему циклу:
    #   1) quart.websocket.receive()
    #   2) ждем (await), пока не получим входящее сообщение
    #   3) quart.websocket.send(data)
    #   4) ждем (await), пока не отправим исходящее сообщение
    #   5) переходим к п. 1
    # Соответственно, если функция находится в п.2 или п.4, то у нас нет никакой возможности
    # отправить сообщение в браузер, пока мы не дождемся сообщения от браузера к серверу.
    # Потому что в цикле чередуются получение и отправка сообщений.
    # Поэтому необходимо код реорганизовать.

    # Для удобства отслеживания в логах -- введем уникальный идентификатор соединения.
    user = f"{quart.websocket.remote_addr}#{random.randint(1000, 9999)}"

    # Определяем функцию-цикл отправки сообщений от сервера к браузеру.
    async def sending():
        while True:
            data = "Время " + str(datetime.datetime.now())
            log.info("Пользователь %s: SEND[%r]", user, data)
            await quart.websocket.send(data)
            await asyncio.sleep(1)

    # Определяем функцию-цикл получения сообщений от браузера сервером.
    async def receiving():
        while True:
            data = await quart.websocket.receive()
            log.info("Пользователь %s: RECV[%r]", user, data)

    # Непосредственно обслуживаем новое соединение.
    try:
        log.info("Пользователь %s подключился :)", user)
        # Следующие две строчки запускают циклы sending и receiving асинхронно.
        # Более точно: в те моменты времени, когда любой из циклов ожидает чего-либо
        # (получения сообщения, отправки сообщения; см. ключевое слово await),
        # любой другой цикл может исполнить свою работу.
        producer = asyncio.create_task(sending())
        consumer = asyncio.create_task(receiving())
        # Дожидаемся окончания работы обоих циклов.
        await asyncio.gather(producer, consumer)
    finally:
        log.info("Пользователь %s отключился :(", user)


def main():
    app.config.from_mapping(DEBUG=True, ENV="development")
    app.run()


if __name__ == "__main__":
    main()
