# Configuration file for the Sphinx documentation builder.
#
# For the full list of built-in configuration values, see the documentation:
# https://www.sphinx-doc.org/en/master/usage/configuration.html

import os
import sys

sys.path.insert(0, os.path.abspath("../src"))

# -- Project information -----------------------------------------------------
project = "genro-tytx"
copyright = "2025, Softwell S.r.l."
author = "Genropy Team"
release = "0.1.0"

# -- General configuration ---------------------------------------------------
extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.viewcode",
    "sphinx.ext.intersphinx",
    "myst_parser",
]

# Napoleon settings (Google-style docstrings)
napoleon_google_docstring = True
napoleon_numpy_docstring = False

# MyST settings (Markdown support)
myst_enable_extensions = [
    "colon_fence",
    "deflist",
]

# Theme
html_theme = "sphinx_rtd_theme"

# Logo
html_logo = "assets/logo.png"

# Source files
source_suffix = {
    ".rst": "restructuredtext",
    ".md": "markdown",
}

# Master document (landing page)
master_doc = "index"

# Intersphinx mapping
intersphinx_mapping = {
    "python": ("https://docs.python.org/3", None),
}

# Templates path
templates_path = ["_templates"]

# Static files path
html_static_path = ["_static"]

# Custom CSS files
html_css_files = ["custom.css"]

# Exclude patterns
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]
