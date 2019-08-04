const fs = require('fs');

/// PARSE BIBTEX

function parseBibAuthors(line) {
  line = line || ''; // sometimes no author is specified
  let authors = [];
  let names = line.split(' and ').map(s => s.trim());
  for (let name of names) {
    if (name.indexOf(',') > -1) {
      let nameParts = name.split(',').map(s => s.trim());
      name = nameParts[1] + ' ' + nameParts[0];
    }
    authors.push(name);
  }
  return authors;
}

function parseBibFile(path) {
  let file = fs.readFileSync(path);
  let lines = file.toString().split('\n').map(line => line.trim());
  let entries = {};
  let currentEntry = null;
  for (let line of lines) {
    if (currentEntry) {
      if (line[0] === '}') {
        // close the current entry
        currentEntry.authors = parseBibAuthors(currentEntry.author);
        currentEntry.scholarQuery = '%22' + currentEntry.title + '%22 ' + (currentEntry.authors[0] || '');
        entries[currentEntry.name] = currentEntry;
        currentEntry = null;
      }
      else if (line.length === 0) {
        // ignore blank lines inside bib entries
      }
      else {
        // parse this line and add its info to the current entry
        line = line.replace(/,$/, '');
        let [_, key, value] = line.match(/([^=]+)\s*=(.*)/);
        key = key.trim();
        value = value.trim();
        value = value.replace(/^{/, '').replace(/}$/, '');
        value = value.replace(/^"/, '').replace(/"$/, '');
        value = value.replace(/[{}]/g, '');
        value = value.replace(/\\"a/g, 'ä');
        value = value.replace(/\\"e/g, 'ë');
        value = value.replace(/\\"i/g, 'ï');
        value = value.replace(/\\"o/g, 'ö');
        value = value.replace(/\\"u/g, 'ü');
        value = value.replace(/\\"u/g, 'ü');
        value = value.replace(/\\aa/g, 'å');
        value = value.replace(/\\/g, '');
        currentEntry[key] = value;
      }
    }
    else {
      if (line[0] === '@') {
        // begin a new entry; parse this line to get its type and name
        let [_, type, name] = line.match(/@([^{]*){(.*),/);
        currentEntry = {type: type, name: name};
      }
      else {
        // ignore everything else
      }
    }
  }
  return entries;
}

/// PARSE LATEX

function parseLatexFile(path) {
  let file = fs.readFileSync(path);
  let lines = file.toString().split('\n');
  let nodes = [];
  let currentMultilineBlock = null;
  const beginKnownMultilineEnv = /^\\begin{(acks|CCSXML|enumerate|figure|itemize|quotation|verbatim)}/;
  const initialSpanLevelCommand = /^\\(cite|emph|textbf|textit|texttt)/;

  for (let line of lines) {
    // if currently inside a multiline block, defer processing this line
    if (currentMultilineBlock) {
      if (line === currentMultilineBlock.end) {
        nodes.push(currentMultilineBlock);
        currentMultilineBlock = null;
      }
      else {
        currentMultilineBlock.lines.push(line);
      }
      continue;
    }

    if (line.trim().length === 0) {
      nodes.push({type: 'empty', text: line});
    }
    else if (line.match(/^\\(.*){[^}]*$/)) {
      let command = line.match(/^\\(.*){/)[1];
      currentMultilineBlock = {type: 'mulilineBlock', command: command, lines: [line], end: '}'};
    }
    else if (line.startsWith('\\iffalse')) {
      currentMultilineBlock = {type: 'iffalseCommentBlock', lines: [], end: '\\fi'};
    }
    else if (line.match(beginKnownMultilineEnv)) {
      let type = line.match(beginKnownMultilineEnv)[1];
      currentMultilineBlock = {type: type, lines: [], end: '\\end{' + type + '}'};
    }
    else if (line.match(/^\\title{(.*)}/)) {
      let title = line.match(/^\\title{(.*)}/)[1];
      nodes.push({type: 'title', title: title, text: line});
    }
    else if (line.match(/^\\subtitle{(.*)}/)) {
      let subtitle = line.match(/^\\subtitle{(.*)}/)[1];
      nodes.push({type: 'subtitle', subtitle: subtitle, text: line});
    }
    else if (line.match(/^\\section{(.*)}/)) {
      let header = line.match(/^\\section{(.*)}/)[1];
      nodes.push({type: 'section', depth: 1, header: header, text: line});
    }
    else if (line.match(/^\\subsection{(.*)}/)) {
      let header = line.match(/^\\subsection{(.*)}/)[1];
      nodes.push({type: 'section', depth: 2, header: header, text: line});
    }
    else if (line.match(/^\\subsubsection{(.*)}/)) {
      let header = line.match(/^\\subsubsection{(.*)}/)[1];
      nodes.push({type: 'section', depth: 3, header: header, text: line});
    }
    else if (line[0] === '\\' && !line.match(initialSpanLevelCommand)) {
      nodes.push({type: 'onelineCommandNode', text: line});
    }
    else {
      let parts = line.split('%');
      let textBeforeComment = parts[0];
      let comment = parts.slice(1).join('%');
      if (textBeforeComment.trim().length > 0) {
        nodes.push({type: 'text', text: textBeforeComment/*, comment: comment*/});
      } else {
        nodes.push({type: 'empty', text: textBeforeComment/*, comment: comment*/});
      }
    }
  }

  return nodes;
}

/// TRANSLATE LATEX NODES TO HTML DOCUMENT

function latexToHtml(latexNodes) {
  let htmlDoc = {};
  let htmlNodes = [];
  let currentParagraph = null;
  for (let node of latexNodes) {
    if (node.type === 'text') {
      if (!currentParagraph) currentParagraph = [];
      currentParagraph.push(node.text);
    }
    else {
      if (currentParagraph) {
        htmlNodes.push({type: 'p', text: currentParagraph.join('\n')});
        currentParagraph = null;
      }

      if (node.type === 'section') {
        let hType =  'h' + (node.depth + 1);
        htmlNodes.push({type: hType, text: node.header});
      }
      else if (node.type === 'title' || node.type === 'subtitle') {
        htmlDoc[node.type] = node[node.type];
      }
      else if (node.type === 'verbatim') {
        htmlNodes.push({type: 'pre', text: node.lines.join('\n')});
      }
      else if (node.type === 'quotation') {
        htmlNodes.push({type: 'blockquote', text: node.lines.join('\n')});
      }
      else if (node.type === 'itemize') {
        htmlNodes.push({type: 'ul', items: node.lines.map(l => l.trim().replace('\\item', ''))});
      }
      else if (node.type === 'enumerate') {
        htmlNodes.push({type: 'ol', items: node.lines.map(l => l.trim().replace('\\item', ''))});
      }
      else if (node.type === 'figure') {
        let lines = node.lines.map(s => s.trim());
        let captionLine = lines.filter(s => s.startsWith('\\caption'))[0];
        let caption = captionLine.replace(/^\\caption{/, '').replace(/}$/, '');
        let graphicsLine = lines.filter(s => s.startsWith('\\includegraphics'))[0];
        let graphics = graphicsLine.match(/{([^}]*)}/)[1];
        let labelLine = lines.filter(s => s.startsWith('\\label'))[0];
        let label = labelLine.match(/{([^}]*)}/)[1];
        htmlNodes.push({type: 'figure', caption, graphics, label, lines: node.lines});
      }
      else if (node.type === 'acks') {
        htmlNodes.push({type: 'acknowledgements', text: node.lines.join('\n')});
      }
    }
  }
  htmlDoc.nodes = htmlNodes;
  return htmlDoc;
}

/// WRITE HTML OUTPUT

let citeIds = {};
function citeId(cite) {
  if (citeIds[cite]) return citeIds[cite];
  citeIds[cite] = Object.keys(citeIds).length + 1;
  return citeIds[cite];
}

function processInnerText(text) {
  // TODO a lot of these will break if you nest styled spans
  text = text.replace(/\\url{([^}]*)}/g, '<a href="$1">$1</a>');
  text = text.replace(/\\emph{([^}]*)}/g, '<em>$1</em>');
  text = text.replace(/\\textit{([^}]*)}/g, '<em>$1</em>');
  text = text.replace(/{\\itshape ([^}]*)}/g, '<em>$1</em>'); // Nick writes italics this way
  text = text.replace(/\\textbf{([^}]*)}/g, '<strong>$1</strong>');
  text = text.replace(/\\texttt{([^}]*)}/g, '<code>$1</code>');
  text = text.replace(/\\footnote{([^}]*)}/g, ''); // TODO do something with footnotes, don't just wipe them
  let citeInstances = text.match(/\\cite(?:\[[^\]]*\])?{([^}]*)}/g) || [];
  for (let citeInstance of citeInstances) {
    citeNames = citeInstance.match(/{([^}]*)}/)[1];
    pageRange = (citeInstance.match(/\[([^\]]*)\]/) || [])[1];
    let cites = citeNames.split(',').map(cite => cite.trim());
    let citeHtml = '[' + cites.map((cite) =>
      `<a href="#ref_${cite}">${citeId(cite)}</a>${pageRange ? `, ${pageRange}` : ''}`
    ).join(', ') + ']';
    text = text.replace(citeInstance, citeHtml);
  }
  text = text.replace(/``/g, '“');
  text = text.replace(/''/g, '”');
  text = text.replace(/(\s)'/g, '$1‘');
  text = text.replace(/'/g, '’');
  text = text.replace(/~/g, '&nbsp;');
  text = text.replace(/---/g, '—');
  text = text.replace(/--/g, '–');
  text = text.replace(/\\c c/g, 'ç'); // as in Façade
  text = text.replace(/{\\"i}/g, 'ï');
  return text;
}

function writeFullHtml(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, user-scalable=no">
  <style>
  body {
    font-family: Georgia, sans-serif;
    line-height: 1.5;
    margin: 2rem auto;
    max-width: 700px;
    padding: 0 1rem;
  }
  h1, h2, h3 {
    line-height: 1.25;
  }
  pre {
    background: #eee;
    padding: 0.5rem;
    -webkit-user-select: all;
    user-select: all;
    white-space: pre-wrap;
  }
  img {
    max-width: 100%;
  }
  .caption {
    font-style: italic;
    text-align: center;
  }
  .caption em {
    font-style: normal;
  }
  /* header, header a { color: #aaa; } */
  </style>
</head>
<body>
<!--<header><a href="/">Max Kreminski</a> / <a href="/">Publications</a></header>-->
<h1>${title}</h1>
<div class="authors">@@AUTHORS@@</div>
<div class="pubinfo">
  Presented at <a href="">AIIDE 2019</a> •
  <a href="#cite">How to cite</a> •
  <a href="@@SCHOLARQUERY@@">Google Scholar</a> •
  <a href="@@PDF@@">PDF</a>
</div>
${bodyHtml}
</body>
</html>`;
}

function writeBibHtml(bibentries) {
  let html = '<h2>References</h2>\n';
  let citesUsed = Object.keys(citeIds);
  for (let name of citesUsed.sort((a,b) => citeIds[a] - citeIds[b])) {
    if (!citeIds[name]) continue;
    let entry = bibentries[name];
    html += `<p class="ref" id="ref_${name}">
            [${citeIds[name]}] ${(entry.authors || []).join(', ')}.
            <a href="https://scholar.google.com/scholar?q=${entry.scholarQuery}">${entry.title}</a>.
            </p>`;
  }
  return html;
}

function writeBodyHtml(htmlDoc, bibentries) {
  let lines = [];
  for (let node of htmlDoc.nodes) {
    let {type, text} = node;
    if (['h2','h3','h4','h5'].indexOf(type) > -1) {
      lines.push(`<${type}>${processInnerText(text)}</${type}>`);
    }
    else if (type === 'p') {
      lines.push(`<p>${processInnerText(text)}</p>`);
    }
    else if (type === 'pre') {
      lines.push(`<pre>${text}</pre>`);
    }
    else if (type === 'blockquote') {
      lines.push(`<blockquote>\n${processInnerText(text)}\n</blockquote>`);
    }
    else if (type === 'ul' || type === 'ol') {
      lines.push(`<${type}>
                  ${node.items.map(i => `<li>${processInnerText(i)}</li>`).join('\n')}
                  </${type}>`);
    }
    else if (type === 'figure') {
      lines.push(`<div class="figure">
                  <img src="${node.graphics}"/>
                  <p class="caption">${processInnerText(node.caption)}</p>
                  </div>`);
    }
    else if (type === 'acknowledgements') {
      lines.push(`<h4>Acknowledgements</h4>\n<p>${processInnerText(text)}</p>`);
    }
  }

  return lines.join('\n');
}

/// TIE EVERYTHING TOGETHER

let bibentries = parseBibFile('./bibliography.bib');
let latexNodes = parseLatexFile(process.argv[2]);
let htmlDoc = latexToHtml(latexNodes);

let bodyHtml = writeBodyHtml(htmlDoc);
bodyHtml += writeBibHtml(bibentries);
let howtociteExample = `<h2 id="cite">How to cite this work</h2>
<pre>
@inproceedings{EvaluatingViaRetellings,
  title={Evaluating {AI}-based games through retellings},
  author={Kreminski, Max and Samuel, Ben and Melcer, Edward and Wardrip-Fruin, Noah},
  booktitle={Fifteenth Artificial Intelligence and Interactive Digital Entertainment Conference},
  year={2019},
  month={10}
}
</pre>`;
bodyHtml += howtociteExample;

let fullHtml = writeFullHtml(htmlDoc.title, bodyHtml);
fs.writeFileSync('index.html', fullHtml);