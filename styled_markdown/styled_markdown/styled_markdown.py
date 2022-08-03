#! /usr/bin/env python
from html import escape
from html.parser import HTMLParser
import typer
from pathlib import Path
from markdown import markdown
from bs4 import BeautifulSoup

H3_CSS_ATTRIBUTES = [
    "padding: 0",
    "margin: 0",
    "border: 0",
    "outline: 0",
    "font-size: 1.462em",
    # "font-family: Lora, Trebuchet MS,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Tahoma,sans-serif",
    "line-height: 1.2",
    "letter-spacing: -0.2px",
]
P_CSS_ATTRIBUTES = [
    "padding: 0.3rem 0 0.7rem",
    "margin: 0",
    "border: 0",
    "outline: 0",
    # "font-family: Trebuchet MS,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Tahoma,sans-serif",
    "line-height: 1.4",
    "font-size: 18px",
    "letter-spacing: -0.2px",
]


# from
# https://stackoverflow.com/questions/52831984/beautifulsoup-prettify-custom-new-line-option
class MyHTMLParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.__t = 0
        self.lines = []
        self.__current_line = ""
        self.__current_tag = ""
        self.__inline_tags = ["u", "i", "em", "b", "strong"]

    @staticmethod
    def __attr_str(attrs):
        return " ".join(
            '{}="{}"'.format(name, escape(value)) for (name, value) in attrs
        )

    def __last_line(self):
        return len(self.lines) - 1

    def handle_starttag(self, tag, attrs):
        str_to_append = f"<{tag}{' ' + self.__attr_str(attrs) if attrs else ''}>"
        if tag in self.__inline_tags:
            self.__current_line += str_to_append
        else:
            self.lines += [self.__current_line]
            self.__current_line = "\t" * self.__t + str_to_append
        self.__current_tag = tag
        self.__t += 1

    def handle_endtag(self, tag):
        self.__t -= 1
        if tag == self.__current_tag:
            str_to_append = f"{self.__current_line}</{tag}>"
            if tag in self.__inline_tags:
                last = self.__last_line()
                self.lines[last] += str_to_append
            else:
                self.lines.append(str_to_append)
        else:
            self.lines += [self.__current_line]
            self.lines += ["\t" * self.__t + "</{}>".format(tag)]

        self.__current_line = ""

    def handle_data(self, data):
        self.__current_line += data

    def get_parsed_string(self):
        return "\n".join(l for l in self.lines if l)


def main(path_to_file: str):
    source_path = Path(path_to_file)
    if not source_path.is_file():
        raise typer.BadParameter(f"File not found: {path_to_file}")

    source_text = open(source_path).read()

    try:
        output_html = markdown(source_text)
        soup = BeautifulSoup(output_html, "html.parser")
        for tag in soup.find_all("h3"):
            tag["style"] = "; ".join(H3_CSS_ATTRIBUTES)
        for tag in soup.find_all("p"):
            tag["style"] = "; ".join(P_CSS_ATTRIBUTES)
            tag.name = "div"

        target_path = Path(f"./{source_path.stem}.html")
        # print(soup.prettify())
        parser = MyHTMLParser()
        parser.feed(str(soup))
        print(parser.get_parsed_string())
    except Exception as exc:
        print(exc)
        typer.Exit(3)


if __name__ == "__main__":
    typer.run(main)
