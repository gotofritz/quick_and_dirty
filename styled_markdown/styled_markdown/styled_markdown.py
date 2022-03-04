#! /usr/bin/env python
import typer
from pathlib import Path
from markdown import markdown
from bs4 import BeautifulSoup

H3_CSS_ATTRIBUTES = [
    "padding: 0",
    "margin: 0",
    "border: 0",
    "outline: 0",
    "font-size: 1.3em",
    "font-family: Lora, Trebuchet MS,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Tahoma,sans-serif",
    "line-height: 1.2",
    "letter-spacing: -0.2px",
]
P_CSS_ATTRIBUTES = [
    "padding: 0.3rem 0 0.7rem",
    "margin: 0",
    "border: 0",
    "outline: 0",
    "font-family: Trebuchet MS,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Tahoma,sans-serif",
    "line-height: 1.4",
    "font-size: 18px",
    "letter-spacing: -0.2px",
]


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
        print(soup.prettify())
    except Exception as exc:
        print(exc)
        typer.Exit(3)


if __name__ == "__main__":
    typer.run(main)
