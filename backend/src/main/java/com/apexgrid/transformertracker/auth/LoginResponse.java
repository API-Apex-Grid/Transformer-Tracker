package com.apexgrid.transformertracker.auth;

public record LoginResponse(String token, long expiresIn, String username, String image) { }
