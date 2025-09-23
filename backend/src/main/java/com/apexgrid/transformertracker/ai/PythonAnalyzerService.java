package com.apexgrid.transformertracker.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

@Service
public class PythonAnalyzerService {
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${app.ai.python:python}")
    private String pythonCommand;

    @Value("${app.ai.script:../AI/analyze.py}")
    private String scriptPath;

    public JsonNode analyze(BufferedImage baseline, BufferedImage candidate) throws Exception {
        File tempDir = Files.createTempDirectory("tt-ai-").toFile();
        File baseFile = new File(tempDir, "baseline.png");
        File candFile = new File(tempDir, "candidate.png");
        // Always write as PNG
        ImageIO.write(baseline, "png", baseFile);
        ImageIO.write(candidate, "png", candFile);

        List<String> cmd = new ArrayList<>();
        cmd.add(pythonCommand);
        cmd.add(new File(scriptPath).getPath());
        cmd.add(baseFile.getAbsolutePath());
        cmd.add(candFile.getAbsolutePath());

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(true);
        pb.directory(new File(System.getProperty("user.dir")));
        Process p = pb.start();

        String output;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
            output = sb.toString();
        }
        int code = p.waitFor();
        // Best-effort cleanup
        try { baseFile.delete(); } catch (Exception ignored) {}
        try { candFile.delete(); } catch (Exception ignored) {}
        try { tempDir.delete(); } catch (Exception ignored) {}

        if (code != 0) {
            throw new IllegalStateException("Python analyzer exited with code " + code + ": " + output);
        }
        // Expect JSON on stdout
        return mapper.readTree(output);
    }
}
