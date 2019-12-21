//------------------------------------------------
// !!!!! vvvvv vvvvv vvvvv vvvvv vvvvv vvvvv vvvvv
//
// TODO(sandello): Модель документа.
//
// Документ (строку) будем моделировать как пару множеств:
//
//   D1 = { (position, symbol) } -- множество пар (позиция, символ);
//   D2 = { position } -- множество удаленных позиций.
//
// Адресация в документе будет строиться по индексам и по позициям.
//
// Индекс -- число -- в классическом понимании идентифицирует символ в строке.
// Индекс меняется от 0 до длины документа минус один.
//
// Позиция -- путь в дереве аллоцированных позиций от корня до листа.
// Позиция кодируется списком индексов потомков на пути от корня до листа.
//
// Пусть A -- арность каждого узла в дереве, например 100. Тогда:
//
//   [0] -- начало строки.
//   [100] -- конец строки (A).
//   [0,14] -- идем к "началу строки", далее к 14-му потомку.
//   [82,11] -- идем к потомку под номером 82, далее к 11-му потомку.

function set_has(set, val) {
    return set.has(val.toString());
}

function set_add(set, val) {
    set.add(val.toString());
}

function map_get(map, key) {
    return map.get(key.toString());
}

function map_set(map, key, val) {
    map.set(key.toString(), val);
}

function set_union(set1, set2) {
    var _union = set1;
    set2.forEach(elem => _union.add(elem));
    return _union;
}

function map_union(map1, map2) {
    var _union = map1;
    map2.forEach(function (val, key) {
        map_set(_union, key, val);
    });
    return _union;
}

function cmpcore(key1, key2) {
    key1 = unToString(key1);
    key2 = unToString(key2);
    for (var i = 0; i < Math.max(key1.length, key2.length); i++) {
        var l = key1.length > i ? key1[i] : -1;
        var r = key2.length > i ? key2[i] : -1;
        if (l != r) {
            return l - r;
        }
    }
    return 0;
}

function cmp(key1, key2) {
    return cmpcore(key1[0], key2[0]);
}

function chg(th, func) {
    func(th);
    return th;
}

function unToString(str) {
    return intify(str.split(","));
}

function intify(arr) {
    var ret = [...arr];
    ret.forEach((val, ind, th) => th[ind] = parseInt(val));
    return ret;
}

function eq(arr1, arr2) {           // if arr1 is prefix of arr2
    // if (arr1.length != arr2.length) {
    //     return false;
    // }
    for (var i = 0; i < arr1.length; i++) {
        if (arr1[i] != arr2[i]) {
            return false;
        }
    }
    return true;
}

const LARGE_LINE = 128;

// === Публичный интерфейс.

// Конструктор.
//
// Инициализирует необходимые структуры данных.
// Результат работы конструктора передается далее во все функции первым аргументом.
function public_newDocument() {
    var th = {
        insert: new Map(),
        delete: new Set(),
        K: 16,
        SIZE: 128,
    };
    return th;
}

// Вернуть содержимое документа в виде строки.
//
// Так как документ представлен как множество пар (позиция, символ) плюс множество удаленных позиций,
// то нужно проитерироваться по всем неудаленным позициям в возрастающем порядке и склеить символы.
function public_getContent(document) {
    var ret = "";
    var th = [...document.insert].filter(elem => !set_has(document.delete, elem[0]))
    th = th.sort(cmp)
    th.forEach(function(elem) {
        ret += elem[1];
    });
    return ret;
}

function public_collapseChanges(document) {
    // EXPIREMENTAL FUNCTION. CAN CRASH ALL SYSTEM. don't recommended to use it too often :)
    document.delete.forEach(function(val) {
        document.insert.delete(val);
    });
    document.delete.clear();
    if (document.insert.size < LARGE_LINE) {
        var nin = public_getContent(document);
        document.insert.clear();
        for (var i = 0; i < nin.length; i++) {
            public_insertAfter(document, i - 1, nin[i]);
        }
    }
}

// Вернуть сериализованное состояние.
//
// Эту функцию можно реализовывать ближе к концу, когда основная функциональность будет готова.
//
// Сериализованное состояние передается далее по сети другим пользователям.
function public_serializeState(document) {
    return JSON.stringify([[...document.insert], [...document.delete]]);
}

// Обновить состояние документа, подклеив полученное сериализованное состояние.
//
// Эту функцию можно реализовывать ближе к концу, когда основная функциональность будет готова.
function public_mergeWithSerializedState(document, serializedState) {
    var th = JSON.parse(serializedState);
    th[0] = new Map(th[0]);
    th[1] = new Set(th[1]);
    document.insert = map_union(document.insert, th[0]);
    document.delete = set_union(document.delete, th[1]);
}

// Добавить один символ по индексу.
//
// Начало строки задается индексом -1.
// После конца строки вставлять нельзя.
// Для вставки в конец строки нужно передать индекс последнего символа (длина минус один).
//
// Реализацию данного метода трогать нельзя.
function public_insertAfter(document, index, symbol) {
    p = _getPositionByIndex(document, index);
    q = _getPositionByIndex(document, index + 1);
    z = _allocate(document, p, q);
    _applyInsert(document, z, symbol);
}

// Удалить символ по индексу.
//
// Реализацию данного метода трогать нельзя.
function public_remove(document, index) {
    p = _getPositionByIndex(document, index);
    _applyRemove(document, p);
}

// Заменить символ по индексу.
//
// Реализацию данного метода трогать нельзя.
function public_replace(document, index, symbol) {
    public_remove(document, index);
    public_insertAfter(document, index - 1, symbol);
}

// === Приватный интерфейс.

// Вычислить позицию символа по его индексу.
//
// Нам важно уметь преобразовывать индексы в позиции и наоборот.
//
// Если index находится в диапазоне [0; N-1] (N -- длина строки),
// то возвращаемая позиция кодирует некоторый узел в дереве.
// Если index равен -1 -- начало строки -- то возвращаемая позиция должна быть [0].
// Если index равен N -- конец строки -- то возвращаемая позиция должна быть [100].
function _getPositionByIndex(document, index) {
    var th = new Map(document.insert);
    document.delete.forEach(function(elem) {
        th.delete(elem);
    });
    th = Array.from(th.keys()).sort(cmpcore);
    if (index > th.length)  {
        debugger;
    }
    switch (index) {
        case -1:
            return [0];
            break;
        case th.length: 
            return [index + 1];
            break;
        default:
            return unToString(th[index]);
            break;
    }
}

function _getIndexByPosition(document, position) {
    var th = new Map(document.insert);
    document.delete.forEach(function(elem) {
        th.delete(elem);
    });
    th = Array.from(th.keys()).sort(cmpcore);
    th.unshift("0");
    th.push(th.length.toString());
    return th.findIndex(elem => elem == position.toString()) - 1;
}

// Аллоцировать новую позицию между двумя границами.
//
// Стратегии аллокации между двумя вершинами могут быть разные.
// Важно аллоцировать не слишком "плотно" новые идентификаторы,
// чтобы обслуживать будущие аллокации без изменения структуры дерева.
//
// Можно следовать стратегии "аллоцировать ближе к левому краю".
// Для этого берем позицию begin и на самом глубоком уровне этой позиции
// пробуем сдвинуться на K направо (K ~ 10-20), чтобы оставить "буфер"
// под будущие правки.
// Если на текущем уровне есть свободные позиции в ближайших K позициях справа,
// то возвращаем крайнюю правую свободную позицию.
// Если на текущем уровне уже нет места, то создаем новый подуровень.
// Важно не забыть проверить, что _нету_ других позиций между begin и свежеаллоцированной позицией.
//
// Такая стратегия оставляет чуть-чуть места для правок между новой позицией и begin,
// и оставляет много места для правок после новой позиции.
// Таким образом, эта стратегия подходит хорошо для ситуаций, когда мы дописываем новый текст.
//
// Пример (здесь "<" значит "предшествует"; K = 10):
//   begin = [4, 52]
//   если позиции с [4, 52] до [4, 62] свободны, то
//   можно аллоцировать [4, 62], так как [4, 52] < [4, 62];
//   begin = [8, 93]
//   можно аллоцировать [8, 93, 10], так как [8, 93] < [8, 93, 10];
//
// Можно следовать стратегии "аллоцировать ближе к правому краю".
// Логика схожая, только отталкиваемся от end и шагаем влево.
// Такая стратегия будет походить для небольших правок в середине текста.
//
// Пример (здесь "<" значит "предшествует"; K = 10):
//   end = [8, 90]
//   если позиции с [8, 80] до [8, 90] свободны, то
//   можно аллоцировать [8, 80];
//   end = [8, 90]
//   если позиция [8, 89] занята,
//   то можно аллоцировать [8, 89, 90];
//
// Лучше всего -- подбрасывать монетку и выбирать случайно одну из двух стратегий выше.
// Таким образом мы будем маскировать незнание паттерна правок в документе.
function _allocate(document, begin, end) {
    return _allocateLeft(document, begin, end);
}

function _allocateLeft(document, begin, end) {
    // begin, end is a positions, which must be allocated => in 'th'. return a position between (begin, end]
    var th = [...set_union(new Set(document.insert.keys()), document.delete)].sort(cmp);
    // console.log(th);
    var has = -1;
    for (var i = 0; i <= document.K; i++) {
        begin[begin.length - 1] += i;
        if (eq(begin, end)) {
            begin[begin.length - 1] -= i;
            break;
        }
        if (begin[begin.length - 1] >= document.SIZE) {
            break;
        } 
        begin[begin.length - 1] += 1;
        if (!th.includes(begin.toString())) {
            has = begin[begin.length - 1];
            break;
        }
        begin[begin.length - 1] -= (i + 1);
    }
    if (has == -1) {
        begin.push(0);
        // debugger;
        return _allocateLeft(document, begin, end);
    }
    else {
        begin.pop();
        begin.push(has);
    }
    return begin;
}

function _allocateRight(document, begin, end) {
    throw Error("not implemented. sorry");
}

// Вставить символ в указанную позицию (не индекс!).
function _applyInsert(document, position, symbol) {
    // console.log('insert:', position, symbol);
    map_set(document.insert, position, symbol);
}

// Удалить символ в указанной позиции.
function _applyRemove(document, position) {
    set_add(document.delete, position);
}

// !!!!! ^^^^^ ^^^^^ ^^^^^ ^^^^^ ^^^^^ ^^^^^ ^^^^^
//------------------------------------------------
