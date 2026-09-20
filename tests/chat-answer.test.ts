import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import ChatAnswer from '../src/components/chat/ChatAnswer';

const render=(text:string)=>renderToStaticMarkup(React.createElement(ChatAnswer,{text}));
describe('readable assistant answers',()=>{
  it('renders distinct reasons and options as semantic lists with bold facts',()=>{
    const html=render('Needs manager review.\n\n**Why**\n- Minimum **3 RNs**.\n- After leave: **2 RNs**.\n\n## Options\n1. Check another date.\n2. Find cover.');
    expect(html).toContain('<strong>3 RNs</strong>');
    expect(html).toContain('<ul><li>Minimum');
    expect(html).toContain('<h4>Options</h4>');
    expect(html).toContain('<ol start="1"><li>Check another date.</li>');
    expect(html).not.toContain('**');
  });
  it('escapes HTML and preserves a numbered list starting later',()=>{
    const html=render('<img src=x onerror=alert(1)>\n\n4. <script>alert(1)</script>');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<ol start="4">');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
  });
  it('keeps paragraphs and handles CRLF and unicode bullets',()=>{
    const html=render('First line\r\ncontinues.\r\n\r\n• One\r\n• Two');
    expect(html).toContain('<p>First line continues.</p>');
    expect(html).toContain('<ul><li>One</li><li>Two</li></ul>');
  });
});
