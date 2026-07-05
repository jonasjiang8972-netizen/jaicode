package main

import (
	"fmt"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/vl"
	"github.com/jonasjiang8972-netizen/jaicode-go/internal/web"
)

func main() {
	v := &vl.Analyzer{}
	w := &web.Server{}
	fmt.Println(v, w)
}
