// N.B. The table is a built-in Javascript object, so key lookup
// only really works for primitives as arguments.
function memoize(f) {
    var memos = {};
    return function (x, y) {
        var key = x + ',' + y;
        if (memos[key] === undefined)
            memos[key] = f(x, y);
        return memos[key];
    };
}

function map(f, xs) {
    var result = [];
    for (var i = 0; i < xs.length; ++i)
        result.push(f(xs[i]));
    return result;
}

function split(s) {
    var result = [];
    var tokens = s.split(/\s+/);
    for (var i = 0; i < tokens.length; ++i)
        if (tokens[i] !== '')
            result.push(tokens[i]);
    return result;
}

// XXX no r'' literals, so regexes will be a pain.
// maybe leave them out?

function parseGrammar(grammar, actions) {
    var parts = (' '+grammar+' ').split(/\s([A-Za-z_]\w*)\s+=\s/);
    if (parts.length <= 1 || parts[0].trim() !== '')
        throw new BadGrammar("Missing left hand side", parts[0]);
    var rules = {};
    for (var i = 1; i < parts.length; i += 2) {
        var lhs = parts[i], rhs = parts[i+1];
        if (lhs in rules)
            throw new BadGrammar("Duplicate rule", lhs);
        var alternatives = (' '+rhs+' ').split(/\s[|]\s/);
        rules[lhs] = map(split, alternatives);
    }
    var default_rule = parts[1];
    return function(text, rule) {
        return parse(rules, actions, rule || default_rule, text);
    };
}

function parse(rules, actions, rule, text) {

    var parseRule = memoize(function(name, pos) {
//        console.log('parseRule', name, pos);
        var farthest = pos;
        var alternatives = rules[name];
        for (var a = 0; a < alternatives.length; ++a) {
            var state = {ok: true, pos: pos, vals: []};
            var tokens = alternatives[a];
            for (var t = 0; t < tokens.length; ++t) {
                state = parseToken(tokens[t], state.pos, state.vals);
                farthest = Math.max(farthest, state.far);
                if (!state.ok) break;
            }
            if (state.ok) {
                state.far = farthest;
                return state;
            }
        }
        return {ok: false, far: farthest};
    });

    function parseToken(token, pos, vals) {
        var res;
        if (/^!./.exec(token) !== null) {
            res = parseToken(token.slice(1), pos, vals);
            return {ok: !res.ok, far: pos, pos: pos, vals: vals};
        }
        else if (rules[token] !== undefined) {
            res = parseRule(token, pos);
            return {ok: res.ok, far: res.far, pos: res.pos,
                    vals: (res.ok ? vals.concat(res.vals) : undefined)};
        }
        else if (actions[token] !== undefined) {
            var f = actions[token];
            return {ok: true, far: pos, pos: pos, vals: [f.apply(null, vals)]};
        }
        else {
            if (/^[A-Za-z_]\w*$/.exec(token) !== null)
                throw new BadGrammar("Missing rule", token);
            if (/^\/.+\/$/.exec(token) !== null)
                token = token.slice(1, token.length-1);
            var re = new RegExp(token, 'g');
            re.lastIndex = pos;
            var match = re.exec(text);
            if (match === null || match.index !== pos)
                return {ok: false, far: pos};
            pos += match[0].length;
            return {ok: true, far: pos, pos: pos, vals: vals.concat(match.slice(1))};
        }
    }

    result = parseRule(rule, 0);
    if (result.ok) return result.vals;
    throw new Unparsable(rule, text, result.far);
}

function Unparsable(rule, text, pos) {
    this.rule = rule;
    this.text = text;
    this.pos = pos;
}

function BadGrammar(plaint, accused) {
    this.plaint = plaint;
    this.accused = accused;
}

function hug() {
    return Array.prototype.slice.call(arguments);
}

function join() {
    return Array.prototype.slice.call(arguments).join('');
}
