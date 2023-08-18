const fs = require('fs');
const { Client } = require('pg');

const {
    User,
    Body,
    Circle,
    Permission,
    Campaign,
    BodyMembership,
    CircleMembership,
    CirclePermission,
    JoinRequest,
    Payment
} = require('../models');
const logger = require('../lib/logger');

const charactersMap = {
    Á: 'A',
    Ă: 'A',
    Ắ: 'A',
    Ặ: 'A',
    Ằ: 'A',
    Ẳ: 'A',
    Ẵ: 'A',
    Ǎ: 'A',
    Â: 'A',
    Ấ: 'A',
    Ậ: 'A',
    Ầ: 'A',
    Ẩ: 'A',
    Ẫ: 'A',
    Ä: 'A',
    Ǟ: 'A',
    Ȧ: 'A',
    Ǡ: 'A',
    Ạ: 'A',
    Ȁ: 'A',
    À: 'A',
    Ả: 'A',
    Ȃ: 'A',
    Ā: 'A',
    Ą: 'A',
    Å: 'A',
    Ǻ: 'A',
    Ḁ: 'A',
    Ⱥ: 'A',
    Ã: 'A',
    Ꜳ: 'AA',
    Æ: 'AE',
    Ǽ: 'AE',
    Ǣ: 'AE',
    Ꜵ: 'AO',
    Ꜷ: 'AU',
    Ꜹ: 'AV',
    Ꜻ: 'AV',
    Ꜽ: 'AY',
    Ḃ: 'B',
    Ḅ: 'B',
    Ɓ: 'B',
    Ḇ: 'B',
    Ƀ: 'B',
    Ƃ: 'B',
    Ć: 'C',
    Č: 'C',
    Ç: 'C',
    Ḉ: 'C',
    Ĉ: 'C',
    Ċ: 'C',
    Ƈ: 'C',
    Ȼ: 'C',
    Ď: 'D',
    Ḑ: 'D',
    Ḓ: 'D',
    Ḋ: 'D',
    Ḍ: 'D',
    Ɗ: 'D',
    Ḏ: 'D',
    ǲ: 'D',
    ǅ: 'D',
    Đ: 'D',
    Ƌ: 'D',
    Ǳ: 'DZ',
    Ǆ: 'DZ',
    É: 'E',
    Ĕ: 'E',
    Ě: 'E',
    Ȩ: 'E',
    Ḝ: 'E',
    Ê: 'E',
    Ế: 'E',
    Ệ: 'E',
    Ề: 'E',
    Ể: 'E',
    Ễ: 'E',
    Ḙ: 'E',
    Ë: 'E',
    Ė: 'E',
    Ẹ: 'E',
    Ȅ: 'E',
    È: 'E',
    Ẻ: 'E',
    Ȇ: 'E',
    Ē: 'E',
    Ḗ: 'E',
    Ḕ: 'E',
    Ę: 'E',
    Ɇ: 'E',
    Ẽ: 'E',
    Ḛ: 'E',
    Ꝫ: 'ET',
    Ḟ: 'F',
    Ƒ: 'F',
    Ǵ: 'G',
    Ğ: 'G',
    Ǧ: 'G',
    Ģ: 'G',
    Ĝ: 'G',
    Ġ: 'G',
    Ɠ: 'G',
    Ḡ: 'G',
    Ǥ: 'G',
    Ḫ: 'H',
    Ȟ: 'H',
    Ḩ: 'H',
    Ĥ: 'H',
    Ⱨ: 'H',
    Ḧ: 'H',
    Ḣ: 'H',
    Ḥ: 'H',
    Ħ: 'H',
    Í: 'I',
    Ĭ: 'I',
    Ǐ: 'I',
    Î: 'I',
    Ï: 'I',
    Ḯ: 'I',
    İ: 'i',
    Ị: 'I',
    Ȉ: 'I',
    Ì: 'I',
    Ỉ: 'I',
    Ȋ: 'I',
    Ī: 'I',
    Į: 'I',
    Ɨ: 'I',
    Ĩ: 'I',
    Ḭ: 'I',
    Ꝺ: 'D',
    Ꝼ: 'F',
    Ᵹ: 'G',
    Ꞃ: 'R',
    Ꞅ: 'S',
    Ꞇ: 'T',
    Ꝭ: 'IS',
    Ĵ: 'J',
    Ɉ: 'J',
    Ḱ: 'K',
    Ǩ: 'K',
    Ķ: 'K',
    Ⱪ: 'K',
    Ꝃ: 'K',
    Ḳ: 'K',
    Ƙ: 'K',
    Ḵ: 'K',
    Ꝁ: 'K',
    Ꝅ: 'K',
    Ĺ: 'L',
    Ƚ: 'L',
    Ľ: 'L',
    Ļ: 'L',
    Ḽ: 'L',
    Ḷ: 'L',
    Ḹ: 'L',
    Ⱡ: 'L',
    Ꝉ: 'L',
    Ḻ: 'L',
    Ŀ: 'L',
    Ɫ: 'L',
    ǈ: 'L',
    Ł: 'L',
    Ǉ: 'LJ',
    Ḿ: 'M',
    Ṁ: 'M',
    Ṃ: 'M',
    Ɱ: 'M',
    Ń: 'N',
    Ň: 'N',
    Ņ: 'N',
    Ṋ: 'N',
    Ṅ: 'N',
    Ṇ: 'N',
    Ǹ: 'N',
    Ɲ: 'N',
    Ṉ: 'N',
    Ƞ: 'N',
    ǋ: 'N',
    Ñ: 'N',
    Ǌ: 'NJ',
    Ó: 'O',
    Ŏ: 'O',
    Ǒ: 'O',
    Ô: 'O',
    Ố: 'O',
    Ộ: 'O',
    Ồ: 'O',
    Ổ: 'O',
    Ỗ: 'O',
    Ö: 'O',
    Ȫ: 'O',
    Ȯ: 'O',
    Ȱ: 'O',
    Ọ: 'O',
    Ő: 'O',
    Ȍ: 'O',
    Ò: 'O',
    Ỏ: 'O',
    Ơ: 'O',
    Ớ: 'O',
    Ợ: 'O',
    Ờ: 'O',
    Ở: 'O',
    Ỡ: 'O',
    Ȏ: 'O',
    Ꝋ: 'O',
    Ꝍ: 'O',
    Ō: 'O',
    Ṓ: 'O',
    Ṑ: 'O',
    Ɵ: 'O',
    Ǫ: 'O',
    Ǭ: 'O',
    Ø: 'O',
    Ǿ: 'O',
    Õ: 'O',
    Ṍ: 'O',
    Ṏ: 'O',
    Ȭ: 'O',
    Ƣ: 'OI',
    Ꝏ: 'OO',
    Ɛ: 'E',
    Ɔ: 'O',
    Ȣ: 'OU',
    Ṕ: 'P',
    Ṗ: 'P',
    Ꝓ: 'P',
    Ƥ: 'P',
    Ꝕ: 'P',
    Ᵽ: 'P',
    Ꝑ: 'P',
    Ꝙ: 'Q',
    Ꝗ: 'Q',
    Ŕ: 'R',
    Ř: 'R',
    Ŗ: 'R',
    Ṙ: 'R',
    Ṛ: 'R',
    Ṝ: 'R',
    Ȑ: 'R',
    Ȓ: 'R',
    Ṟ: 'R',
    Ɍ: 'R',
    Ɽ: 'R',
    Ꜿ: 'C',
    Ǝ: 'E',
    Ś: 'S',
    Ṥ: 'S',
    Š: 'S',
    Ṧ: 'S',
    Ş: 'S',
    Ŝ: 'S',
    Ș: 'S',
    Ṡ: 'S',
    Ṣ: 'S',
    Ṩ: 'S',
    ß: 'ss',
    Ť: 'T',
    Ţ: 'T',
    Ṱ: 'T',
    Ț: 'T',
    Ⱦ: 'T',
    Ṫ: 'T',
    Ṭ: 'T',
    Ƭ: 'T',
    Ṯ: 'T',
    Ʈ: 'T',
    Ŧ: 'T',
    Ɐ: 'A',
    Ꞁ: 'L',
    Ɯ: 'M',
    Ʌ: 'V',
    Ꜩ: 'TZ',
    Ú: 'U',
    Ŭ: 'U',
    Ǔ: 'U',
    Û: 'U',
    Ṷ: 'U',
    Ü: 'U',
    Ǘ: 'U',
    Ǚ: 'U',
    Ǜ: 'U',
    Ǖ: 'U',
    Ṳ: 'U',
    Ụ: 'U',
    Ű: 'U',
    Ȕ: 'U',
    Ù: 'U',
    Ủ: 'U',
    Ư: 'U',
    Ứ: 'U',
    Ự: 'U',
    Ừ: 'U',
    Ử: 'U',
    Ữ: 'U',
    Ȗ: 'U',
    Ū: 'U',
    Ṻ: 'U',
    Ų: 'U',
    Ů: 'U',
    Ũ: 'U',
    Ṹ: 'U',
    Ṵ: 'U',
    Ꝟ: 'V',
    Ṿ: 'V',
    Ʋ: 'V',
    Ṽ: 'V',
    Ꝡ: 'VY',
    Ẃ: 'W',
    Ŵ: 'W',
    Ẅ: 'W',
    Ẇ: 'W',
    Ẉ: 'W',
    Ẁ: 'W',
    Ⱳ: 'W',
    Ẍ: 'X',
    Ẋ: 'X',
    Ý: 'Y',
    Ŷ: 'Y',
    Ÿ: 'Y',
    Ẏ: 'Y',
    Ỵ: 'Y',
    Ỳ: 'Y',
    Ƴ: 'Y',
    Ỷ: 'Y',
    Ỿ: 'Y',
    Ȳ: 'Y',
    Ɏ: 'Y',
    Ỹ: 'Y',
    Ź: 'Z',
    Ž: 'Z',
    Ẑ: 'Z',
    Ⱬ: 'Z',
    Ż: 'Z',
    Ẓ: 'Z',
    Ȥ: 'Z',
    Ẕ: 'Z',
    Ƶ: 'Z',
    Ĳ: 'IJ',
    Œ: 'OE',
    ᴀ: 'A',
    ᴁ: 'AE',
    ʙ: 'B',
    ᴃ: 'B',
    ᴄ: 'C',
    ᴅ: 'D',
    ᴇ: 'E',
    ꜰ: 'F',
    ɢ: 'G',
    ʛ: 'G',
    ʜ: 'H',
    ɪ: 'I',
    ʁ: 'R',
    ᴊ: 'J',
    ᴋ: 'K',
    ʟ: 'L',
    ᴌ: 'L',
    ᴍ: 'M',
    ɴ: 'N',
    ᴏ: 'O',
    ɶ: 'OE',
    ᴐ: 'O',
    ᴕ: 'OU',
    ᴘ: 'P',
    ʀ: 'R',
    ᴎ: 'N',
    ᴙ: 'R',
    ꜱ: 'S',
    ᴛ: 'T',
    ⱻ: 'E',
    ᴚ: 'R',
    ᴜ: 'U',
    ᴠ: 'V',
    ᴡ: 'W',
    ʏ: 'Y',
    ᴢ: 'Z',
    á: 'a',
    ă: 'a',
    ắ: 'a',
    ặ: 'a',
    ằ: 'a',
    ẳ: 'a',
    ẵ: 'a',
    ǎ: 'a',
    â: 'a',
    ấ: 'a',
    ậ: 'a',
    ầ: 'a',
    ẩ: 'a',
    ẫ: 'a',
    ä: 'a',
    ǟ: 'a',
    ȧ: 'a',
    ǡ: 'a',
    ạ: 'a',
    ȁ: 'a',
    à: 'a',
    ả: 'a',
    ȃ: 'a',
    ā: 'a',
    ą: 'a',
    ᶏ: 'a',
    ẚ: 'a',
    å: 'a',
    ǻ: 'a',
    ḁ: 'a',
    ⱥ: 'a',
    ã: 'a',
    ꜳ: 'aa',
    æ: 'ae',
    ǽ: 'ae',
    ǣ: 'ae',
    ꜵ: 'ao',
    ꜷ: 'au',
    ꜹ: 'av',
    ꜻ: 'av',
    ꜽ: 'ay',
    ḃ: 'b',
    ḅ: 'b',
    ɓ: 'b',
    ḇ: 'b',
    ᵬ: 'b',
    ᶀ: 'b',
    ƀ: 'b',
    ƃ: 'b',
    ɵ: 'o',
    ć: 'c',
    č: 'c',
    ç: 'c',
    ḉ: 'c',
    ĉ: 'c',
    ɕ: 'c',
    ċ: 'c',
    ƈ: 'c',
    ȼ: 'c',
    ď: 'd',
    ḑ: 'd',
    ḓ: 'd',
    ȡ: 'd',
    ḋ: 'd',
    ḍ: 'd',
    ɗ: 'd',
    ᶑ: 'd',
    ḏ: 'd',
    ᵭ: 'd',
    ᶁ: 'd',
    đ: 'd',
    ɖ: 'd',
    ƌ: 'd',
    ı: 'i',
    ȷ: 'j',
    ɟ: 'j',
    ʄ: 'j',
    ǳ: 'dz',
    ǆ: 'dz',
    é: 'e',
    ĕ: 'e',
    ě: 'e',
    ȩ: 'e',
    ḝ: 'e',
    ê: 'e',
    ế: 'e',
    ệ: 'e',
    ề: 'e',
    ể: 'e',
    ễ: 'e',
    ḙ: 'e',
    ë: 'e',
    ė: 'e',
    ẹ: 'e',
    ȅ: 'e',
    è: 'e',
    ẻ: 'e',
    ȇ: 'e',
    ē: 'e',
    ḗ: 'e',
    ḕ: 'e',
    ⱸ: 'e',
    ę: 'e',
    ᶒ: 'e',
    ɇ: 'e',
    ẽ: 'e',
    ḛ: 'e',
    ꝫ: 'et',
    ḟ: 'f',
    ƒ: 'f',
    ᵮ: 'f',
    ᶂ: 'f',
    ǵ: 'g',
    ğ: 'g',
    ǧ: 'g',
    ģ: 'g',
    ĝ: 'g',
    ġ: 'g',
    ɠ: 'g',
    ḡ: 'g',
    ᶃ: 'g',
    ǥ: 'g',
    ḫ: 'h',
    ȟ: 'h',
    ḩ: 'h',
    ĥ: 'h',
    ⱨ: 'h',
    ḧ: 'h',
    ḣ: 'h',
    ḥ: 'h',
    ɦ: 'h',
    ẖ: 'h',
    ħ: 'h',
    ƕ: 'hv',
    í: 'i',
    ĭ: 'i',
    ǐ: 'i',
    î: 'i',
    ï: 'i',
    ḯ: 'i',
    ị: 'i',
    ȉ: 'i',
    ì: 'i',
    ỉ: 'i',
    ȋ: 'i',
    ī: 'i',
    į: 'i',
    ᶖ: 'i',
    ɨ: 'i',
    ĩ: 'i',
    ḭ: 'i',
    ꝺ: 'd',
    ꝼ: 'f',
    ᵹ: 'g',
    ꞃ: 'r',
    ꞅ: 's',
    ꞇ: 't',
    ꝭ: 'is',
    ǰ: 'j',
    ĵ: 'j',
    ʝ: 'j',
    ɉ: 'j',
    ḱ: 'k',
    ǩ: 'k',
    ķ: 'k',
    ⱪ: 'k',
    ꝃ: 'k',
    ḳ: 'k',
    ƙ: 'k',
    ḵ: 'k',
    ᶄ: 'k',
    ꝁ: 'k',
    ꝅ: 'k',
    ĺ: 'l',
    ƚ: 'l',
    ɬ: 'l',
    ľ: 'l',
    ļ: 'l',
    ḽ: 'l',
    ȴ: 'l',
    ḷ: 'l',
    ḹ: 'l',
    ⱡ: 'l',
    ꝉ: 'l',
    ḻ: 'l',
    ŀ: 'l',
    ɫ: 'l',
    ᶅ: 'l',
    ɭ: 'l',
    ł: 'l',
    ǉ: 'lj',
    ſ: 's',
    ẜ: 's',
    ẛ: 's',
    ẝ: 's',
    ḿ: 'm',
    ṁ: 'm',
    ṃ: 'm',
    ɱ: 'm',
    ᵯ: 'm',
    ᶆ: 'm',
    ń: 'n',
    ň: 'n',
    ņ: 'n',
    ṋ: 'n',
    ȵ: 'n',
    ṅ: 'n',
    ṇ: 'n',
    ǹ: 'n',
    ɲ: 'n',
    ṉ: 'n',
    ƞ: 'n',
    ᵰ: 'n',
    ᶇ: 'n',
    ɳ: 'n',
    ñ: 'n',
    ǌ: 'nj',
    ó: 'o',
    ŏ: 'o',
    ǒ: 'o',
    ô: 'o',
    ố: 'o',
    ộ: 'o',
    ồ: 'o',
    ổ: 'o',
    ỗ: 'o',
    ö: 'o',
    ȫ: 'o',
    ȯ: 'o',
    ȱ: 'o',
    ọ: 'o',
    ő: 'o',
    ȍ: 'o',
    ò: 'o',
    ỏ: 'o',
    ơ: 'o',
    ớ: 'o',
    ợ: 'o',
    ờ: 'o',
    ở: 'o',
    ỡ: 'o',
    ȏ: 'o',
    ꝋ: 'o',
    ꝍ: 'o',
    ⱺ: 'o',
    ō: 'o',
    ṓ: 'o',
    ṑ: 'o',
    ǫ: 'o',
    ǭ: 'o',
    ø: 'o',
    ǿ: 'o',
    õ: 'o',
    ṍ: 'o',
    ṏ: 'o',
    ȭ: 'o',
    ƣ: 'oi',
    ꝏ: 'oo',
    ɛ: 'e',
    ᶓ: 'e',
    ɔ: 'o',
    ᶗ: 'o',
    ȣ: 'ou',
    ṕ: 'p',
    ṗ: 'p',
    ꝓ: 'p',
    ƥ: 'p',
    ᵱ: 'p',
    ᶈ: 'p',
    ꝕ: 'p',
    ᵽ: 'p',
    ꝑ: 'p',
    ꝙ: 'q',
    ʠ: 'q',
    ɋ: 'q',
    ꝗ: 'q',
    ŕ: 'r',
    ř: 'r',
    ŗ: 'r',
    ṙ: 'r',
    ṛ: 'r',
    ṝ: 'r',
    ȑ: 'r',
    ɾ: 'r',
    ᵳ: 'r',
    ȓ: 'r',
    ṟ: 'r',
    ɼ: 'r',
    ᵲ: 'r',
    ᶉ: 'r',
    ɍ: 'r',
    ɽ: 'r',
    ↄ: 'c',
    ꜿ: 'c',
    ɘ: 'e',
    ɿ: 'r',
    ś: 's',
    ṥ: 's',
    š: 's',
    ṧ: 's',
    ş: 's',
    ŝ: 's',
    ș: 's',
    ṡ: 's',
    ṣ: 's',
    ṩ: 's',
    ʂ: 's',
    ᵴ: 's',
    ᶊ: 's',
    ȿ: 's',
    ɡ: 'g',
    ᴑ: 'o',
    ᴓ: 'o',
    ᴝ: 'u',
    ť: 't',
    ţ: 't',
    ṱ: 't',
    ț: 't',
    ȶ: 't',
    ẗ: 't',
    ⱦ: 't',
    ṫ: 't',
    ṭ: 't',
    ƭ: 't',
    ṯ: 't',
    ᵵ: 't',
    ƫ: 't',
    ʈ: 't',
    ŧ: 't',
    ᵺ: 'th',
    ɐ: 'a',
    ᴂ: 'ae',
    ǝ: 'e',
    ᵷ: 'g',
    ɥ: 'h',
    ʮ: 'h',
    ʯ: 'h',
    ᴉ: 'i',
    ʞ: 'k',
    ꞁ: 'l',
    ɯ: 'm',
    ɰ: 'm',
    ᴔ: 'oe',
    ɹ: 'r',
    ɻ: 'r',
    ɺ: 'r',
    ⱹ: 'r',
    ʇ: 't',
    ʌ: 'v',
    ʍ: 'w',
    ʎ: 'y',
    ꜩ: 'tz',
    ú: 'u',
    ŭ: 'u',
    ǔ: 'u',
    û: 'u',
    ṷ: 'u',
    ü: 'u',
    ǘ: 'u',
    ǚ: 'u',
    ǜ: 'u',
    ǖ: 'u',
    ṳ: 'u',
    ụ: 'u',
    ű: 'u',
    ȕ: 'u',
    ù: 'u',
    ủ: 'u',
    ư: 'u',
    ứ: 'u',
    ự: 'u',
    ừ: 'u',
    ử: 'u',
    ữ: 'u',
    ȗ: 'u',
    ū: 'u',
    ṻ: 'u',
    ų: 'u',
    ᶙ: 'u',
    ů: 'u',
    ũ: 'u',
    ṹ: 'u',
    ṵ: 'u',
    ᵫ: 'ue',
    ꝸ: 'um',
    ⱴ: 'v',
    ꝟ: 'v',
    ṿ: 'v',
    ʋ: 'v',
    ᶌ: 'v',
    ⱱ: 'v',
    ṽ: 'v',
    ꝡ: 'vy',
    ẃ: 'w',
    ŵ: 'w',
    ẅ: 'w',
    ẇ: 'w',
    ẉ: 'w',
    ẁ: 'w',
    ⱳ: 'w',
    ẘ: 'w',
    ẍ: 'x',
    ẋ: 'x',
    ᶍ: 'x',
    ý: 'y',
    ŷ: 'y',
    ÿ: 'y',
    ẏ: 'y',
    ỵ: 'y',
    ỳ: 'y',
    ƴ: 'y',
    ỷ: 'y',
    ỿ: 'y',
    ȳ: 'y',
    ẙ: 'y',
    ɏ: 'y',
    ỹ: 'y',
    ź: 'z',
    ž: 'z',
    ẑ: 'z',
    ʑ: 'z',
    ⱬ: 'z',
    ż: 'z',
    ẓ: 'z',
    ȥ: 'z',
    ẕ: 'z',
    ᵶ: 'z',
    ᶎ: 'z',
    ʐ: 'z',
    ƶ: 'z',
    ɀ: 'z',
    ﬀ: 'ff',
    ﬃ: 'ffi',
    ﬄ: 'ffl',
    ﬁ: 'fi',
    ﬂ: 'fl',
    ĳ: 'ij',
    œ: 'oe',
    ﬆ: 'st',
    ₐ: 'a',
    ₑ: 'e',
    ᵢ: 'i',
    ⱼ: 'j',
    ₒ: 'o',
    ᵣ: 'r',
    ᵤ: 'u',
    ᵥ: 'v',
    ₓ: 'x',
    Ё: 'YO',
    Й: 'I',
    Ц: 'TS',
    У: 'U',
    К: 'K',
    Е: 'E',
    Н: 'N',
    Г: 'G',
    Ш: 'SH',
    Щ: 'SCH',
    З: 'Z',
    Х: 'H',
    Ъ: "'",
    ё: 'yo',
    й: 'i',
    ц: 'ts',
    у: 'u',
    к: 'k',
    е: 'e',
    н: 'n',
    г: 'g',
    ш: 'sh',
    щ: 'sch',
    з: 'z',
    х: 'h',
    ъ: "'",
    Ф: 'F',
    Ы: 'I',
    В: 'V',
    А: 'a',
    П: 'P',
    Р: 'R',
    О: 'O',
    Л: 'L',
    Д: 'D',
    Ж: 'ZH',
    Э: 'E',
    ф: 'f',
    ы: 'i',
    в: 'v',
    а: 'a',
    п: 'p',
    р: 'r',
    о: 'o',
    л: 'l',
    д: 'd',
    ж: 'zh',
    э: 'e',
    Я: 'Ya',
    Ч: 'CH',
    С: 'S',
    М: 'M',
    И: 'I',
    Т: 'T',
    Ь: "'",
    Б: 'B',
    Ю: 'YU',
    я: 'ya',
    ч: 'ch',
    с: 's',
    м: 'm',
    и: 'i',
    т: 't',
    ь: "'",
    б: 'b',
    ю: 'yu',
    ' ': '-',
    i̇: 'i',
    '̇': ''
};

const sluggify = (message) => message
    .toLowerCase()
    .replace(/[^A-Za-z0-9- ,.]/g, (x) => charactersMap[x] || x);

const errored = {
    users: [],
    bodies: [],
    circles: [],
    permissions: [],
    campaigns: []
};

let client;

async function migrateUsers() {
    // creating members
    const users = await client.query('select *, members.id as member_id from users inner join members on users.id = members.user_id');
    logger.info('Creating users');
    for (const index in users.rows) {
        const user = users.rows[index];
        try {
            const username = sluggify(
                user.name.trim()
                    .replace(/ /g, '.')
                    .replace(/@/g, '.at.')
                    .replace(/İ/g, 'i')
                    .replace(/i̇/g, '')
                    .replace(/:/g, '')
                    .replace(/\)/g, '')
                    .replace(/�/g, '')
                    .replace(/🦊/g, 'lisa')
                    .replace(/👨🏼‍🎨/g, '')
                    .replace(/ə/g, '')
                    .replace(/'/g, '')
                    .replace(/º/g, '')
                    .replace(/!/g, '')
                    .replace(/\$/g, '')
            ).toLowerCase();

            if (username !== user.name) {
                if (username.toLowerCase() === user.name.toLowerCase()) {
                    logger.info(`${index}/${users.rows.length} lower case username '${user.name}' -> '${username}'`);
                } else {
                    logger.info(`${index}/${users.rows.length} change username '${user.name}' -> '${username}'`);
                }
            }

            const email = user.email.replace(/�/g, '');
            if (email !== user.email) {
                logger.info(`${index}/${users.rows.length} change email '${user.email}' -> '${email}'`);
            }

            const firstName = user.first_name
                .replace(/�/g, '')
                .replace(/_/g, '');
            if (firstName !== user.first_name) {
                logger.info(`${index}/${users.rows.length} change first_name '${user.first_name}' -> '${firstName}'`);
            }

            const lastName = user.last_name
                .replace(/�/g, '')
                .replace(/_/g, '');
            if (lastName !== user.last_name) {
                logger.info(`${index}/${users.rows.length} change last_name '${user.last_name}' -> '${lastName}'`);
            }

            await User.create({
                ...user,
                id: user.member_id,
                username,
                first_name: firstName,
                last_name: lastName,
                email,
                created_at: user.inserted_at,
                mail_confirmed_at: new Date()
            });
            if (index % 100 === 0) {
                logger.info(`Created user, index ${index}/${users.rows.length}`);
            }
            // logger.info({ user: user.email }, 'Created user');
        } catch (err) {
            logger.error({ err }, 'User creating error');
            errored.users.push(user);
        }
    }

    fs.writeFileSync('./migration.json', JSON.stringify(errored, null, '    '));
}

async function migrateBodies() {
    const bodies = await client.query('select * from bodies');
    logger.info('Creating bodies');
    for (const body of bodies.rows) {
        try {
            await Body.create({
                ...body,
                code: body.legacy_key,
                shadow_circle_id: null,
                phone: body.phone || '-'
            });
            // logger.info({ body: body.name }, 'Created body');
        } catch (err) {
            logger.error({ err }, 'Body creating error');
            errored.bodies.push(body);
        }
    }

    fs.writeFileSync('./migration.json', JSON.stringify(errored, null, '    '));
}

async function migrateCircles() {
    const circles = await client.query('select * from circles');
    logger.info('Creating circles');
    for (const circle of circles.rows) {
        try {
            await Circle.create({
                ...circle,
                parent_circle_id: null
            });
        } catch (err) {
            logger.error({ err }, 'Circle creating error');
            errored.circles.push(circle);
        }
    }

    logger.info('Creating parent circles');
    for (const circle of circles.rows) {
        try {
            const c = await Circle.findByPk(circle.id);
            await c.update({ parent_circle_id: circle.parent_circle_id });
        } catch (err) {
            logger.error({ err }, 'Circle updating parent circle error');
            errored.circles.push(circle);
        }
    }

    fs.writeFileSync('./migration.json', JSON.stringify(errored, null, '    '));
}

async function migratePermissions() {
    const permissions = await client.query('select * from permissions');
    logger.info('Creating permissions');
    for (const permission of permissions.rows) {
        try {
            await Permission.create({ ...permission });
            // logger.info({ permission: permission.combined }, 'Created permission');
        } catch (err) {
            logger.error({ err }, 'Permission creating error');
            errored.permissions.push(permission);
        }
    }

    fs.writeFileSync('./migration.json', JSON.stringify(errored, null, '    '));
}

async function migrateCampaigns() {
    const campaigns = await client.query('select * from campaigns');
    logger.info('Creating campaigns');
    for (const campaign of campaigns.rows) {
        try {
            await Campaign.create({
                ...campaign,
                description_long: campaign.description_long || '-'
            });
        } catch (err) {
            logger.error({ campaign, err }, 'Campaing creating error');
            errored.campaigns.push(campaign);
        }
    }

    fs.writeFileSync('./migration.json', JSON.stringify(errored, null, '    '));
}

async function migrateShadowCircles() {
    const bodies = await client.query('select * from bodies');
    logger.info('Adding shadow circles');
    for (const body of bodies.rows) {
        try {
            const b = await Body.findByPk(body.id);
            await b.update({ shadow_circle_id: body.shadow_circle_id });
        } catch (err) {
            logger.error({ err }, 'Adding shadow circle creating error');
        }
    }
}

async function migrateBodyMemberships() {
    const memberships = await client.query('select * from body_memberships');
    logger.info('Creating body memberships');
    logger.info(`Length: ${memberships.rows.length}`);
    for (const index in memberships.rows) {
        const membership = memberships.rows[index];
        try {
            await BodyMembership.create({
                ...membership,
                user_id: membership.member_id
            }, { hooks: false });

            if (index % 100 === 0) {
                logger.info(`Created body membership, index ${index}/${memberships.rows.length}`);
            }
        } catch (err) {
            logger.error({ membership, err }, 'Body membership creating error');
            return;
        }
    }
}

async function migrateCircleMemberships() {
    const memberships = await client.query('select * from circle_memberships');
    logger.info('Creating circle memberships');
    logger.info(`Length: ${memberships.rows.length}`);
    for (const index in memberships.rows) {
        const membership = memberships.rows[index];
        try {
            await CircleMembership.create({
                ...membership,
                user_id: membership.member_id
            });

            if (index % 100 === 0) {
                logger.info(`Created circle membership, index ${index}/${memberships.rows.length}`);
            }
        } catch (err) {
            logger.error({ membership, err }, 'Circle membership creating error');
        }
    }
}

async function migrateCirclePermissions() {
    const permissions = await client.query('select * from circle_permissions');
    logger.info('Creating circle permissions');
    logger.info(`Length: ${permissions.rows.length}`);
    for (const index in permissions.rows) {
        const permission = permissions.rows[index];
        try {
            await CirclePermission.create({
                ...permission
            });

            if (index % 100 === 0) {
                logger.info(`Created circle permission, index ${index}/${permissions.rows.length}`);
            }
        } catch (err) {
            logger.error({ permission, err }, 'Circle permission creating error');
        }
    }
}

async function migrateJoinRequests() {
    const requests = await client.query('select * from join_requests');
    logger.info('Creating join requests');
    logger.info(`Length: ${requests.rows.length}`);
    for (const index in requests.rows) {
        const request = requests.rows[index];
        try {
            await JoinRequest.create({
                ...request,
                user_id: request.member_id,
                status: request.approved ? 'approved' : 'pending'
            });
            if (index % 100 === 0) {
                logger.info(`Created join request, index ${index}/${requests.rows.length}`);
            }
        } catch (err) {
            logger.error({ request, err }, 'Join request creating error');
        }
    }
}

async function migratePayments() {
    const payments = await client.query('select * from payments');
    logger.info('Creating payments');
    logger.info(`Length: ${payments.rows.length}`);
    for (const index in payments.rows) {
        const payment = payments.rows[index];
        if (!payment.member_id) {
            continue;
        }
        try {
            await Payment.create({ ...payment, user_id: payment.member_id });
        } catch (err) {
            logger.error({ payment, err }, 'Payment creating error');
        }

        if (index % 100 === 0) {
            logger.info(`Created payment, index ${index}/${payments.rows.length}`);
        }
    }
}

async function migrateSubmissionIds() {
    const submissions = await client.query(`
select users.id as user_id, members.id as member_id, submissions.campaign_id as campaign_id
from users
inner join members on users.id = members.user_id
inner join submissions on submissions.user_id = users.id`);
    logger.info('Creating submissions ids');
    logger.info(`Length: ${submissions.rows.length}`);

    for (const index in submissions.rows) {
        const submission = submissions.rows[index];
        if (!submission.member_id) {
            continue;
        }
        try {
            const userFromDb = await User.findByPk(submission.member_id);
            await userFromDb.update({ campaign_id: submission.campaign_id });
        } catch (err) {
            logger.error({ submission, err }, 'Submission id creating error');
        }

        if (index % 100 === 0) {
            logger.info(`Created submission id, index ${index}/${submissions.rows.length}`);
        }
    }
}

(async () => {
    client = new Client({
        connectionString: `postgres://postgres:${process.env.PG_PASSWORD}@postgres-oms-core-elixir:5432/omscore_dev`
    });
    await client.connect();

    logger.info('Connected to DB');

    await migrateBodies();
    await migrateCircles();
    await migratePermissions();
    await migrateCampaigns();
    await migrateUsers();
    await migrateShadowCircles();
    await migrateBodyMemberships();
    await migrateCircleMemberships();
    await migrateCirclePermissions();
    await migrateJoinRequests();
    await migratePayments();
    await migrateSubmissionIds();

    logger.info('All done');

    await client.end();
    process.exit(0);
})();
