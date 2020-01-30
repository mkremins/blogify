# blogify
Academic papers are _basically_ just blog posts. But we publish them as ugly PDFs that are awkward to read (especially on a mobile device) and lack basic affordances we've come to expect from the web. So no one actually reads them.

But what if we could automagically transform an academic paper into a web page that looks and feels just like any other blog post? Then we could trick people into reading _all kinds_ of stuff.

`blogify` does this! It's an experimental and incredibly janky script that can transform certain "well-formed" LaTeX and BibTeX source files into nice clean HTML pages, complete with some basic mobile-friendly CSS and a few other conveniences.

Internally, it's a bit of a nightmare. There is nothing resembling a proper LaTeX parser here – just a bunch of ad-hoc regular expressions, which _seem_ to _mostly_ work on the incredibly restricted subset of LaTeX that I and my three most frequent collaborators happened to use in the handful of papers I tested it on.

I seriously doubt this script will work for you out of the box. In fact, it barely even works for _me_ – half the papers I run through it come out with some minor errors that I need to patch up by hand. But I'm putting it up here on the off chance that someone might find it useful.

## why not do this _correctly_

Before I wrote this script, I tried a bunch of the LaTeX-to-HTML conversion thingies that already exist. As far as I can tell, none of them actually do the thing I want them to do. This is probably my own fault somehow; I am not good with computer.
