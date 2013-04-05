var Lexer = require('./lexer/Lexer'),
	EcmascriptRule = require('./lexer/rule/EcmascriptRule'),
	Token = require('./lexer/Token'),
	Parser = require('./parser/Parser'),
	Node = require('./parser/Node'),
	character = require('./util/character'),
	env,
	temp,
	bindId,
	bind,
	rest,
	restLength,
	preHash,
	classes,
	index,
	res,
	node;

function init() {
	index = 0;
	preHash = {};
	res = '';
	env = [0];
	temp = '';
	bind = '';
	rest = '';
	restLength = 0;
	classes = [];
}
function join(node, ignore) {
	var isToken = node.name() == Node.TOKEN,
		isVirtual = isToken && node.token().type() == Token.VIRTUAL;
	if(isToken) {
		if(!isVirtual) {
			var token = node.token();
			//���Ե�token
			if(['var', '...', 'static'].indexOf(token.content()) == -1) {
				if(token.content() == 'let' || token.content() == 'const') {
					res += 'var';
				}
				else {
					res += token.content();
				}
			}
			while(ignore[++index]) {
				res += ignore[index].content();
			}
		}
	}
	else {
		//varǰ����������򶥲�
		if(node.name() == Node.VARSTMT) {
			preVar(node);
		}
		//��¼������������ջ����Ĭ�ϲ���ʡ�Ը�ֵ�������
		else if(node.name() == Node.FNBODY) {
			var i = res.lastIndexOf('{') + 1;
			env.push(i);
			if(bind.length) {
				res = res.slice(0, i) + bind + res.slice(i);
				i += bind.length;
				bind = '';
			}
			if(rest.length) {
				res = res.slice(0, i) + rest + ' = Array.prototype.slice.call(arguments, ' + restLength + ');' + res.slice(i);
				rest = '';
				restLenght = 0;
			}
		}
		//���block�ӽڵ��Ƿ���let��const
		else if(node.name() == Node.BLOCK) {
			var blockHasLet = false;
			node.leaves().forEach(function(leaf) {
				if(!blockHasLet && (leaf.name() == Node.LETSTMT || leaf.name() == Node.CSTSTMT)) {
					blockHasLet = true;
				}
			});
		}
		//for������Ƿ���let
		else if(node.name() == Node.ITERSTMT && node.leaves()[0].token().content() == 'for') {
			var forHasLet = node.leaves()[2].name() == Node.LETSTMT;
			if(forHasLet) {
				forstmt(true, res.length);
			}
		}
		//��¼fnparams���Ĭ�ϸ�ֵ��ʡ�Ը�ֵ
		else if(node.name() == Node.FNPARAMS) {
			bindelement(node);
			restparam(node);
		}
		//Ĭ�ϸ�ֵǰ���浱ǰ�����֮�󻥻�
		else if(node.name() == Node.BINDELEMENT) {
			temp = res;
		}
		//class��ʼ
		else if(node.name() == Node.CLASSDECL) {
			classdecl(true, node);
		}
		else if(node.name() == Node.CLASSBODY) {
			classbody(true, node);
		}
		else if(node.name() == Node.METHOD) {
			method(true, node);
		}
		//�滻super
		else if(node.name() == Node.SUPERSTMT) {
			superstmt(true, node);
		}
		//�ݹ��ӽڵ�
		node.leaves().forEach(function(leaf, i) {
			if(blockHasLet && i == 1) {
				block(true);
			}
			join(leaf, ignore, index);
		});
		//fnbody�������������ջ
		if(node.name() == Node.FNBODY) {
			env.pop();
		}
		//block����������let��const��������function����ģ��鼶������
		else if(node.name() == Node.BLOCK && blockHasLet) {
			block(false);
		}
		//for����������letҲ�����ģ��
		else if(node.name() == Node.ITERSTMT && forHasLet) {
			forstmt(false, res.length);
		}
		//Ĭ�ϲ���������
		else if(node.name() == Node.BINDELEMENT) {
			var id = bindId.shift();
			bind += 'if(typeof ' + id + ' == "undefined") ' + id + res.slice(temp.length) + ';';
			res = temp;
		}
		//class����
		else if(node.name() == Node.CLASSDECL) {
			classdecl(false, node);
		}
		else if(node.name() == Node.CLASSBODY) {
			classbody(false, node);
		}
		else if(node.name() == Node.METHOD) {
			method(false, node);
		}
		//�滻super
		else if(node.name() == Node.SUPERSTMT) {
			superstmt(false, node);
		}
	}
}
function preVar(varstmt) {
	var index = env[env.length - 1];
	preHash[index] = preHash[index] || {};
	for(var i = 1, leaves = varstmt.leaves(), len = leaves.length; i < len; i += 2) {
		var vn = leaves[i].leaves()[0].token().content();
		if(preHash[index][vn]) {
			return;
		}
		preHash[index][vn] = true;
		var prefix = res.slice(0, index),
			suffix = res.slice(index);
		res = prefix + 'var ' + vn + ';' + suffix;
	}
}
function block(startOrEnd) {
	var index = startOrEnd ? res.lastIndexOf('{') + 1 : res.lastIndexOf('}');
		prefix = res.slice(0, index),
		suffix = res.slice(index);
	if(startOrEnd) {
		res = prefix + '(function() {' + suffix;
	}
	else {
		res = prefix + '}).call(this);' + suffix;
	}
}
function forstmt(startOrEnd, index) {
	var prefix = res.slice(0, index),
		suffix = res.slice(index);
	if(startOrEnd) {
		res = prefix + '(function() {' + suffix;
	}
	else {
		res = prefix + '}).call(this);' + suffix;
	}
}
function bindelement(node) {
	bindId = [];
	for(var i = 1, leaves = node.leaves(), len = leaves.length; i < len; i++) {
		if(leaves[i].name() == Node.BINDELEMENT) {
			bindId.push(leaves[i - 1].token().content());
			i += 2;
		}
	}
}
function restparam(node) {
	var leaves = node.leaves(),
		len = leaves.length;
	if(leaves[len - 1].name() == Node.RESTPARAM) {
		rest = leaves[len - 1].leaves()[1].token().content();
		for(var i = 1; i < len - 1; i++) {
			if(leaves[i].name() == Node.TOKEN && leaves[i].token().content() == character.COMMA) {
				restLength++;
			}
		}
	}
}
function classdecl(startOrEnd, node) {
	if(startOrEnd) {
		classes.push({
			start: res.length,
			name: node.leaves()[1].token().content(),
			statics: {}
		});
		if(node.leaves()[2].name() == Node.HERITAGE) {
			var id = node.leaves()[2].leaves()[1].token().content();
			classes[classes.length - 1].heritage = id;
		}
	}
	else {
		var nowClass = classes[classes.length - 1];
		if(!nowClass.hasCon) {
			res = res.slice(0, nowClass.fnstart) + '(){ ' + (nowClass.heritage ? nowClass.heritage + '.call(this)' : '') + ' }' + res.slice(nowClass.fnstart);
		}
		var i = res.lastIndexOf('}'),
			prefix = res.slice(0, i),
			suffix = res.slice(i + 1);
		if(nowClass.heritage) {
			prefix += nowClass.name + '.prototype = Object.create(' + nowClass.heritage + '.prototype); ' + nowClass.name + '.prototype.constructor = ' + nowClass.name + ';'
			prefix += ' Object.keys(' + nowClass.heritage + ').forEach(function(k) { ' + nowClass.name + '[k] = ' + nowClass.heritage + '[k] });';
		}
		res = prefix + suffix;
	}
}
function classbody(startOrEnd, node) {
	var nowClass = classes[classes.length - 1];
	if(startOrEnd) {
		//��¼static����
		for(var i = 0, len = node.leaves().length; i < len; i++) {
			var leaf = node.leaves()[i];
			if(leaf.name() == Node.TOKEN && leaf.token().content() == 'static') {
				leaf = node.leaves()[++i].leaves()[0].token();
				nowClass.statics[leaf.content()] = true;
			}
		}
		var decl = res.slice(nowClass.start),
			count = character.count(decl, character.LINE);
		res = res.slice(0, nowClass.start) + 'function ' + nowClass.name;
		nowClass.fnstart = res.length;
		for(var i = 0; i < count; i++) {
			res += character.LINE;
		}
	}
}
function method(startOrEnd, node) {
	var nowClass = classes[classes.length - 1];
	if(startOrEnd) {
		var id = node.leaves()[0].token().content();
		nowClass.mstart = res.length;
		nowClass.mid = id;
		nowClass.isCon = id == 'constructor';
		if(nowClass.isCon) {
			nowClass.hasCon = true;
			nowClass.constart = res.length;
		}
	}
	else {
		if(nowClass.isCon) {
			res = res.slice(0, nowClass.fnstart) + res.slice(nowClass.constart + nowClass.mid.length) + res.slice(nowClass.fnstart, nowClass.constart);
		}
		else {
			if(nowClass.statics[nowClass.mid]) {
				res = res.slice(0, nowClass.mstart) + nowClass.name + '.' + nowClass.mid + ' = function' + res.slice(nowClass.mstart + nowClass.mid.length);
			}
			else {
				res = res.slice(0, nowClass.mstart) + nowClass.name + '.prototype.' + nowClass.mid + ' = function' + res.slice(nowClass.mstart + nowClass.mid.length);
			}
		}
	}
}
function superstmt(startOrEnd, node) {
	var nowClass = classes[classes.length - 1];
	if(startOrEnd) {
		nowClass.superstart = res.length;
		nowClass.supernum = 0;
		node.leaves().forEach(function(node) {
			if(node.name() == Node.TOKEN && node.token().content() == 'super') {
				nowClass.supernum++;
			}
		});
	}
	else {
		var prefix = res.slice(0, nowClass.superstart),
			suffix = res.slice(nowClass.superstart),
			first = true;
		if(nowClass.isCon) {
			suffix = suffix.replace('super', nowClass.heritage);
		}
		else {
			while(nowClass.supernum-- > 0) {
				if(first) {
					suffix = suffix.replace('super', nowClass.heritage + '.prototype');
					first = false;
				}
				else {
					suffix = suffix.replace('super', 'constructor.prototype');
				}
			}
		}
		var i = suffix.indexOf('('),
			j = suffix.lastIndexOf(')');
		res = prefix + suffix.slice(0, i) + '.call(this, ' + suffix.slice(i + 1, j) + ')' + suffix.slice(j + 1);
	}
}

exports.parse = function(code) {
	var lexer = new Lexer(new EcmascriptRule());
	lexer.parse(code);
	var parser = new Parser(lexer),
		ignore = {};
	try {
		node = parser.program();
		ignore = parser.ignore();
	} catch(e) {
		if(console) {
			console.error(e);
		}
		return e.toString();
	}
	init();
	join(node, ignore);
	return character.escapeHTML(res);
};
exports.tree = function() {
	return node;
};
