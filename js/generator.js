/**
 * Vaultwarden Replica - Password Generator
 * Cryptographically secure password and passphrase generator with strength scoring.
 */

const PasswordGenerator = {
  LOWERCASE: 'abcdefghijklmnopqrstuvwxyz',
  UPPERCASE: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  NUMBERS: '0123456789',
  SYMBOLS: '!@#$%^&*()_+-=[]{}|;:,.<>?',

  WORDLIST: [
    'abacaxi', 'abelha', 'abobora', 'abrigo', 'acordo', 'adubo', 'agulha', 'alarme',
    'aldeia', 'alecrim', 'alface', 'algodao', 'alianca', 'almoco', 'almofada', 'amarelo',
    'amendoa', 'amigo', 'ancora', 'anel', 'anjo', 'antena', 'anzol', 'apito',
    'arame', 'arara', 'arenito', 'areia', 'arvore', 'asfalto', 'aviao', 'azeite',
    'azulejo', 'azul', 'bacia', 'bagagem', 'banco', 'bandeira', 'banho', 'barco',
    'barriga', 'batata', 'bau', 'beijo', 'beleza', 'bicho', 'bigode', 'biscoito',
    'blusa', 'boneca', 'bosque', 'bota', 'botao', 'braco', 'branco', 'brinco',
    'brisa', 'bronze', 'buraco', 'buzina', 'cabana', 'cabelo', 'cacau', 'cadeira',
    'caderno', 'cafe', 'caixa', 'caju', 'calca', 'camelo', 'camisa', 'campo',
    'canal', 'caneca', 'caneta', 'canoa', 'canto', 'capivara', 'capsula', 'carro',
    'carta', 'cartao', 'carvalho', 'casaco', 'casca', 'castelo', 'cavalo', 'cebola',
    'cedro', 'cenoura', 'cereja', 'cesta', 'chave', 'cheiro', 'chinelo', 'chocolate',
    'chuva', 'cidade', 'cimento', 'cinema', 'circo', 'cisne', 'clima', 'coelho',
    'cofre', 'colar', 'colher', 'colina', 'copo', 'coracao', 'corda', 'coroa',
    'corpo', 'coruja', 'costela', 'couro', 'cravo', 'cristal', 'dado', 'damasco',
    'dente', 'desenho', 'diamante', 'diario', 'dicionario', 'dinheiro', 'disco', 'doce',
    'dragao', 'duende', 'duque', 'elefante', 'envelope', 'escada', 'escova', 'escudo',
    'esfinge', 'espada', 'espelho', 'espiga', 'esponja', 'esquilo', 'estrada', 'estrela',
    'farinha', 'farol', 'fazenda', 'feijao', 'ferradura', 'festa', 'figo', 'fivela',
    'flecha', 'floresta', 'flor', 'fogao', 'fogo', 'foguete', 'folha', 'formiga',
    'fonte', 'forno', 'frasco', 'frente', 'fruta', 'fumaca', 'fundo', 'gaivota',
    'galho', 'galinha', 'garfo', 'garrafa', 'gaveta', 'gelo', 'girafa', 'girassol',
    'globo', 'golfinho', 'gorila', 'gota', 'grade', 'grama', 'granito', 'gravata',
    'grilo', 'gruta', 'guarda', 'guitarra', 'harpa', 'helice', 'heroi', 'hiena',
    'hotel', 'iate', 'iglu', 'ilha', 'ima', 'imperador', 'inverno', 'isopor',
    'jabuti', 'jacare', 'jaguar', 'janela', 'jardim', 'jarra', 'jasmim', 'javali',
    'joaninha', 'joelho', 'joia', 'jornal', 'juiz', 'lagarto', 'lago', 'lagoa',
    'lagosta', 'lampada', 'lanterna', 'lapis', 'laranja', 'lareira', 'leao', 'lebre',
    'leite', 'lente', 'leopardo', 'limao', 'linha', 'livro', 'lobo', 'lousa',
    'lontra', 'lua', 'luva', 'maca', 'macaco', 'machado', 'madeira', 'magia',
    'mala', 'maleta', 'mamona', 'manga', 'manjericao', 'manteiga', 'marfim', 'marreco',
    'martelo', 'mascara', 'medalha', 'melancia', 'melao', 'mesa', 'moeda', 'moinho',
    'mola', 'morango', 'morcego', 'motor', 'muro', 'musica', 'navio', 'neve',
    'ninho', 'noite', 'novelo', 'nuvem', 'oculos', 'oleo', 'onca', 'onda',
    'ouro', 'ovelha', 'pacote', 'padaria', 'palacio', 'palha', 'panela', 'pano',
    'papagaio', 'papel', 'parafuso', 'parede', 'parque', 'passaro', 'pato', 'pedra',
    'peixe', 'pelicano', 'pena', 'penhasco', 'pepino', 'pera', 'peroba', 'perola',
    'piano', 'picareta', 'pimenta', 'pincel', 'pingente', 'pinho', 'pipoca', 'pirata',
    'pistola', 'placa', 'planeta', 'planta', 'pluma', 'poco', 'poeira', 'ponte',
    'porta', 'portal', 'pranto', 'prata', 'prato', 'prego', 'primavera', 'prisma',
    'quadro', 'queijo', 'quindim', 'raposa', 'rato', 'recife', 'relogio', 'rio',
    'rocha', 'roda', 'rosa', 'sabao', 'sabedoria', 'sabonete', 'sacola', 'saia',
    'salada', 'sapato', 'sardinha', 'seda', 'sela', 'selva', 'serra', 'sino',
    'sirene', 'sofa', 'sol', 'sombra', 'sonho', 'sopa', 'tabua', 'tamanco',
    'tambor', 'tampa', 'tapete', 'tartaruga', 'tecido', 'teclado', 'telha', 'tempo',
    'tenda', 'terra', 'tesoura', 'tijolo', 'tigre', 'tinta', 'toca', 'toalha',
    'torre', 'trator', 'trevo', 'trilho', 'trofeu', 'trombeta', 'tubarao', 'tulipa',
    'turquesa', 'urso', 'uva', 'vagao', 'valsa', 'vapor', 'vaso', 'vassoura',
    'veado', 'vela', 'veleiro', 'vento', 'verao', 'verdade', 'vidro', 'vila',
    'vinho', 'violeta', 'violao', 'viseira', 'vulcao', 'xadrez', 'xarope', 'xicara',
    'zebra', 'zelador', 'zepelim', 'zinco'
  ],

  /**
   * Generate password with specified options.
   * @param {Object} [options={}]
   * @param {number} [options.length=16]
   * @param {boolean} [options.uppercase=true]
   * @param {boolean} [options.lowercase=true]
   * @param {boolean} [options.numbers=true]
   * @param {boolean} [options.symbols=true]
   * @param {number} [options.minNumbers=1]
   * @param {number} [options.minSymbols=1]
   * @returns {string} Generated password.
   */
  generate(options = {}) {
    const defaults = {
      length: 16,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      minNumbers: 1,
      minSymbols: 1
    };
    const opts = { ...defaults, ...options };

    // Fallback if all charset flags are disabled
    if (!opts.lowercase && !opts.uppercase && !opts.numbers && !opts.symbols) {
      opts.lowercase = true;
    }

    const targetLength = Math.max(1, parseInt(opts.length, 10) || 16);
    const chars = [];
    let pool = '';

    if (opts.lowercase) {
      pool += this.LOWERCASE;
      chars.push(this.LOWERCASE[this._getRandomInt(this.LOWERCASE.length)]);
    }
    if (opts.uppercase) {
      pool += this.UPPERCASE;
      chars.push(this.UPPERCASE[this._getRandomInt(this.UPPERCASE.length)]);
    }
    if (opts.numbers) {
      pool += this.NUMBERS;
      const count = Math.max(1, parseInt(opts.minNumbers, 10) || 1);
      for (let i = 0; i < count; i++) {
        chars.push(this.NUMBERS[this._getRandomInt(this.NUMBERS.length)]);
      }
    }
    if (opts.symbols) {
      pool += this.SYMBOLS;
      const count = Math.max(1, parseInt(opts.minSymbols, 10) || 1);
      for (let i = 0; i < count; i++) {
        chars.push(this.SYMBOLS[this._getRandomInt(this.SYMBOLS.length)]);
      }
    }

    // Truncate if guaranteed minimums exceed target length
    if (chars.length > targetLength) {
      chars.length = targetLength;
    }

    // Fill remaining positions from the combined pool
    while (chars.length < targetLength) {
      const charIndex = this._getRandomInt(pool.length);
      chars.push(pool[charIndex]);
    }

    // Secure Fisher-Yates shuffle
    for (let i = chars.length - 1; i > 0; i--) {
      const j = this._getRandomInt(i + 1);
      const temp = chars[i];
      chars[i] = chars[j];
      chars[j] = temp;
    }

    return chars.join('');
  },

  /**
   * Generate passphrase using words from WORDLIST.
   * @param {Object} [options={}]
   * @param {number} [options.wordCount=4]
   * @param {string} [options.separator='-']
   * @param {boolean} [options.capitalize=true]
   * @param {boolean} [options.includeNumber=true]
   * @returns {string} Generated passphrase.
   */
  generatePassphrase(options = {}) {
    const defaults = {
      wordCount: 4,
      separator: '-',
      capitalize: true,
      includeNumber: true
    };
    const opts = { ...defaults, ...options };
    const count = Math.max(1, parseInt(opts.wordCount, 10) || 4);
    const separator = opts.separator !== undefined ? opts.separator : '-';
    const words = [];

    for (let i = 0; i < count; i++) {
      let word = this.WORDLIST[this._getRandomInt(this.WORDLIST.length)];
      if (opts.capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      words.push(word);
    }

    let result = words.join(separator);
    if (opts.includeNumber) {
      const randomDigit = this._getRandomInt(10);
      result += `${separator}${randomDigit}`;
    }

    return result;
  },

  /**
   * Calculate password strength.
   * @param {string} password - Password to test.
   * @returns {{score: number, label: string, percentage: number}}
   */
  calculateStrength(password) {
    if (!password || typeof password !== 'string') {
      return { score: 0, label: 'Muito Fraca', percentage: 0 };
    }

    const length = password.length;
    if (length === 0) {
      return { score: 0, label: 'Muito Fraca', percentage: 0 };
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[^a-zA-Z0-9]/.test(password);
    const charsetCount = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;

    // Check for obvious patterns: repeated characters or common sequential keys
    const hasRepeats = /(.)\1{2,}/.test(password);
    const hasSequential = /(123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|qwer|asdf)/i.test(password);
    const hasCommonPatterns = hasRepeats || hasSequential;

    let score = 0;

    if (length < 6) {
      score = 0;
    } else if (length < 8 || charsetCount === 1) {
      score = 1;
    } else if (length >= 16 && charsetCount >= 4 && !hasCommonPatterns) {
      score = 4;
    } else if (length >= 12 && charsetCount >= 3) {
      score = 3;
    } else if (length >= 8 && charsetCount >= 2) {
      score = 2;
    } else {
      score = 1;
    }

    const labels = ['Muito Fraca', 'Fraca', 'Razoável', 'Forte', 'Muito Forte'];
    const percentages = [10, 25, 50, 75, 100];

    return {
      score,
      label: labels[score],
      percentage: percentages[score]
    };
  },

  /**
   * Get cryptographically secure random integer in range [0, max).
   * @param {number} max - Upper bound (exclusive).
   * @returns {number} Random integer.
   * @private
   */
  _getRandomInt(max) {
    if (max <= 0) return 0;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
};

window.passwordGenerator = PasswordGenerator;
