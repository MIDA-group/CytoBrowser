#!/bin/bash
# Download and convert a Hamamatsu brightfield WSI with 1 z-plane


#Exit on error (sourced or subshell)
trap 'echo Error $? on line $LINENO; trap - ERR; return 2>/dev/null || exit' ERR


#Download a 1GB example image - Ki-67 stain, brightfield, circa 2012
wget -nc http://openslide.cs.cmu.edu/download/openslide-testdata/Hamamatsu/OS-2.ndpi
file="OS-2.ndpi"
name="Hamamatsu-${file%.*}"

#Verify the image size
#bftools/showinf -nopix -nometa "${file}"


#Using libvips to directly create Deep Zoom images (dzi), note the '_z0' suffix to indicate only the zero-level z-plane
mkdir -p data
vips --vips-progress dzsave "${file}" --tile-size 256 --overlap 0 --suffix .jpg[Q=90] data/"${name}"_z0


#If you have a z-stacked ndpi file, we suggest to use ndpisplit of NDPITools to extract the individual z-planes
# https://www.imnc.in2p3.fr/pagesperso/deroulers/software/ndpitools/


xdg-open http://localhost:8080/?image="${name}"
