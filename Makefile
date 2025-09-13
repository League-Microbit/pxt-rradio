
VERSION := $(shell grep '"version"' pxt.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')


# Initial setup 
setup: 
	npm install -g pxt
	pxt target microbit
	pxt install

build:
	PXT_FORCE_LOCAL=1 pxt build


deploy:
	PXT_FORCE_LOCAL=1 pxt deploy

test:
	pxt test

serve:
	PXT_FORCE_LOCAL=1  pxt serve


push: build 
	git commit --allow-empty -a -m "Release version $(VERSION)"
	git push
	git tag v$(VERSION) 
	git push --tags


